import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { generate } from "../src/generator.js";

for (const template of ["make", "autotools", "cmake"]) {
  test(`${template}: native source build and DESTDIR install smoke check (not BitBake)`, { skip: process.platform !== "linux" }, async () => {
    const root = await mkdtemp(path.join(tmpdir(), "pi-foundry-"));
    const source = path.join(root, "source");
    const build = path.join(root, "build");
    const stage = path.join(root, "stage");
    const run = (command, args, cwd, env = {}) => {
      const result = spawnSync(command, args, { cwd, env: { ...process.env, ...env }, encoding: "utf8" });
      assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${result.error || ""}\n${result.stdout}\n${result.stderr}`);
      return result.stdout;
    };
    try {
      await mkdir(source); await mkdir(build);
      const files = generate({ template, name: "my-custom-app" }).files;
      for (const file of files.filter(file => file.path.includes("/files/project/"))) {
        await writeFile(path.join(source, file.path.split("/").at(-1)), file.content);
      }
      if (template === "make") {
        run("make", ["CC=cc", "CFLAGS=-O2 -Wall -Werror", "CPPFLAGS=", "LDFLAGS="], source);
        run("make", ["install", `DESTDIR=${stage}`, "prefix=/usr", "bindir=/usr/bin"], source);
      } else if (template === "autotools") {
        run("autoreconf", ["--install", "--force"], source);
        run(path.join(source, "configure"), ["--prefix=/usr", "--bindir=/usr/bin"], build);
        run("make", [], build);
        run("make", ["install", `DESTDIR=${stage}`], build);
      } else {
        run("cmake", ["-S", source, "-B", build, "-DCMAKE_INSTALL_PREFIX=/usr", "-DCMAKE_INSTALL_BINDIR=bin"], root);
        run("cmake", ["--build", build], root);
        run("cmake", ["--install", build], root, { DESTDIR: stage });
      }
      const executable = path.join(stage, "usr", "bin", "my-custom-app");
      await access(executable);
      assert.match(run(executable, [], root), /Hello from my Raspberry Pi!/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
