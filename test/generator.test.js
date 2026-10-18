import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { archive, BOARDS, DEFAULTS, generate, localConfig, RELEASE, setupCommands, validate } from "../src/generator.js";
import { guideSteps } from "../src/guide.js";

const git = {
  source: "git", gitUrl: "https://github.com/example/fixture.git", branch: "release/1.0",
  revision: "a".repeat(40), licenseFile: "COPYING", licenseMd5: "b".repeat(32),
};
const recipe = result => result.files.find(file => file.path.endsWith(`/${DEFAULTS.name}_${DEFAULTS.version}.bb`)).content;

for (const board of Object.keys(BOARDS)) {
  for (const template of ["c", "cpp", "data"]) {
    for (const source of ["local", "git"]) {
      test(`${board} / ${template} / ${source}: complete consistent starter`, () => {
        const sourceFile = { c: "src/main.c", cpp: "src/main.cpp", data: "assets/message.txt" }[template];
        const result = generate({ ...DEFAULTS, ...(source === "git" ? git : {}), board, template, sourceFile });
        assert.deepEqual(result.errors, {});
        const bb = recipe(result);
        assert.match(bb, /SUMMARY = ".+"/);
        assert.match(bb, /DESCRIPTION = ".+"/);
        assert.match(bb, /LICENSE = "MIT"/);
        assert.match(bb, /DEPENDS = ""/);
        assert.match(bb, /B = "\$\{WORKDIR\}\/build"/);
        assert.match(bb, /do_install\(\)/);
        assert.match(bb, /"\$\{D\}\$\{/);
        assert.match(result.files.find(file => file.path === "local.conf.snippet").content, new RegExp(`MACHINE = "${board}"`));
        assert.match(result.files.find(file => file.path === "local.conf.snippet").content, /IMAGE_INSTALL:append = " hello-pi"/);
        const layer = result.files.find(file => file.path.endsWith("layer.conf")).content;
        assert.match(layer, /LAYERSERIES_COMPAT_myboard = "scarthgap"/);
        assert.match(layer, /LAYERDEPENDS_myboard = "core"/);
        if (source === "local") {
          assert.equal(result.files.length, 7);
          assert.match(bb, /S = "\$\{WORKDIR\}"/);
          assert.match(bb, /COMMON_LICENSE_DIR.*0835ade698e0bcf8506ecda2f7b4f302/);
          const sourceFileOutput = result.files.find(file => file.path.includes("/files/"));
          assert.ok(sourceFileOutput);
          assert.ok(bb.includes(`file://${sourceFileOutput.path.split("/").at(-1)}`));
        } else {
          assert.equal(result.files.length, 6);
          assert.ok(bb.includes('SRC_URI = "git://github.com/example/fixture.git;protocol=https;branch=release/1.0"'));
          assert.ok(bb.includes(`SRCREV = "${git.revision}"`));
          assert.match(bb, /S = "\$\{WORKDIR\}\/git"/);
          assert.ok(bb.includes(`file://COPYING;md5=${git.licenseMd5}`));
          assert.ok(bb.includes(`"\${S}/${sourceFile}"`));
        }
        if (template === "data") {
          assert.match(bb, /inherit allarch/);
          assert.match(bb, /do_compile\[noexec\] = "1"/);
          assert.match(bb, /install -m 0644/);
          assert.match(bb, /FILES:\$\{PN\} = "\$\{datadir\}\/\$\{PN\}"/);
          assert.doesNotMatch(bb, /\$\{CC\}|\$\{CXX\}/);
        } else {
          assert.ok(bb.includes(template === "c" ? "${CC} ${CFLAGS}" : "${CXX} ${CXXFLAGS}"));
          assert.match(bb, /\$\{CPPFLAGS\}/);
          assert.match(bb, /\$\{LDFLAGS\}/);
          assert.match(bb, /install -m 0755/);
        }
        assert.doesNotThrow(() => archive(result.files));
      });
    }
  }
}

test("local Make/CMake executable names cannot collide with build targets", () => {
  for (const template of ["make", "cmake"]) {
    for (const name of ["all", "clean", "install", "help", "test", "package"]) {
      const result = generate({ template, name });
      assert.ok(result.errors.name);
      assert.deepEqual(result.files, []);
    }
  }
  assert.deepEqual(generate({ template: "c", name: "all" }).errors, {});
});

test("CLOSED requires no license checksum and does not pretend to relicense Git sources", () => {
  for (const source of ["local", "git"]) {
    const result = generate({ ...(source === "git" ? git : {}), license: "CLOSED", licenseFile: "", licenseMd5: "" });
    assert.deepEqual(result.errors, {});
    assert.match(recipe(result), /LICENSE = "CLOSED"/);
    assert.doesNotMatch(recipe(result), /LIC_FILES_CHKSUM/);
  }
});

for (const board of Object.keys(BOARDS)) {
  for (const template of ["make", "autotools", "cmake"]) {
    for (const source of ["local", "git"]) {
      test(`${board} / ${template} / ${source}: build system owns the right tasks and ships complete inputs`, () => {
        const result = generate({ ...(source === "git" ? git : {}), board, template, name: "my-custom-app", depends: "zlib" });
        assert.deepEqual(result.errors, {});
        const bb = result.files[0].content;
        assert.match(bb, /DEPENDS \+= "zlib"/);
        assert.ok(result.files.find(file => file.path === "local.conf.snippet").content.includes(`MACHINE = "${board}"`));
        if (template === "make") {
          assert.match(bb, /B = "\$\{S\}"/);
          assert.match(bb, /do_configure\[noexec\] = "1"/);
          assert.match(bb, /do_compile\(\) \{\n    oe_runmake/);
          assert.match(bb, /oe_runmake 'DESTDIR=\$\{D\}' install/);
          for (const flag of ["CC", "CFLAGS", "CPPFLAGS", "LDFLAGS", "prefix", "bindir"]) assert.ok(bb.includes(`'${flag}=\${${flag}}'`));
        } else {
          assert.ok(bb.includes(`inherit ${template}`));
          assert.doesNotMatch(bb, /do_(configure|compile|install)(?:\(\)|\[noexec\])/);
          assert.doesNotMatch(bb, /^B =/m);
        }
        if (source === "local") {
          assert.match(bb, /SRC_URI = "file:\/\/project\/"/);
          assert.match(bb, /S = "\$\{WORKDIR\}\/project"/);
          const inputs = result.files.filter(file => file.path.includes("/files/project/"));
          const expected = ["main.c", ...(template === "make" ? ["Makefile"] : template === "autotools" ? ["configure.ac", "Makefile.am"] : ["CMakeLists.txt"])];
          assert.deepEqual(inputs.map(file => file.path.split("/").at(-1)).sort(), expected.sort());
          assert.match(inputs.find(file => file.path.endsWith("main.c")).content, /#include <stdio.h>/);
          const build = inputs.find(file => !file.path.endsWith("main.c")).content;
          assert.ok(build.includes("my-custom-app"));
          if (template === "make") assert.match(build, /\n\tinstall -m 0755.*\$\(DESTDIR\)\$\(bindir\)/);
          if (template === "autotools") assert.ok(inputs.find(file => file.path.endsWith("Makefile.am")).content.includes("my_custom_app_SOURCES = main.c"));
          if (template === "cmake") assert.match(build, /install\(TARGETS my-custom-app RUNTIME DESTINATION \$\{CMAKE_INSTALL_BINDIR\}\)/);
        } else {
          assert.match(bb, /S = "\$\{WORKDIR\}\/git"/);
          assert.ok(bb.includes(`SRCREV = "${git.revision}"`));
          assert.equal(result.files.filter(file => file.path.includes("/files/")).length, 0);
        }
        assert.deepEqual(unpackTar(archive(result.files)), result.files);
      });
    }
  }
}

test("dependencies are normalized; image includes the custom package name", () => {
  const result = generate({ name: "my-sensor", depends: "  zlib   openssl virtual/libgl  ", version: "2.1.0" });
  assert.deepEqual(result.errors, {});
  assert.match(result.files[0].content, /DEPENDS = "zlib openssl virtual\/libgl"/);
  assert.ok(result.files[0].path.endsWith("my-sensor_2.1.0.bb"));
  assert.match(result.files.find(file => file.path.endsWith("my-rpi-image.bb")).content, /IMAGE_INSTALL:append = " my-sensor"/);
});

const invalid = [
  ["name", "../escape"], ["name", "UPPER"], ["name", "hello_world"], ["name", "a;id"],
  ["name", "hello-"], ["name", "-hello"], ["name", "a".repeat(61)], ["name", null],
  ["version", "1.0;touch"], ["version", "../../"], ["version", "latest"], ["version", null],
  ["summary", 'hi"\ndo_install() { evil; }'], ["summary", "${@evil()}"],
  ["description", "bad\\escape"], ["description", "bad`id`"], ["description", "\u0000"],
  ["depends", "zlib;id"], ["depends", "${CC}"], ["depends", "zlib\nopenssl"],
  ["depends", "virtual/"], ["depends", "a/b"], ["depends", null],
  ["board", "__proto__"], ["board", "raspberrypi5-64"], ["board", null],
  ["template", "shell"], ["source", "archive"], ["license", "made-up"],
];
for (const [field, value] of invalid) {
  test(`reject ${field}: ${JSON.stringify(value)}`, () => {
    const result = generate({ [field]: value });
    assert.ok(result.errors[field]);
    assert.deepEqual(result.files, []);
  });
}

for (const [field, value] of [
  ["gitUrl", "https://user:secret@example.com/repo.git"],
  ["gitUrl", "ssh://git@example.com/repo"], ["gitUrl", "https://example.com/repo;protocol=file"],
  ["gitUrl", "https://example.com/repo?token=secret"], ["gitUrl", "https://example.com/repo#fragment"],
  ["gitUrl", "https://example.com/../repo"], ["gitUrl", "https://example.com/%22evil"],
  ["gitUrl", "file:///etc/passwd"], ["gitUrl", null],
  ["revision", "HEAD"], ["revision", "${AUTOREV}"], ["revision", "a".repeat(39)], ["revision", null],
  ["branch", "main;protocol=file"], ["branch", "main..evil"], ["branch", "a//b"],
  ["branch", "main.lock"], ["branch", "a/.hidden"], ["branch", "a."],
  ["sourceFile", "../main.c"], ["sourceFile", "/main.c"], ["sourceFile", "-main.c"],
  ["sourceFile", "src/../../main.c"], ["sourceFile", "main.cpp"],
  ["sourceFile", "src/main.c;id"], ["sourceFile", "src/with space.c"],
  ["licenseFile", "../LICENSE"], ["licenseMd5", ""], ["licenseMd5", "not-a-checksum"],
]) {
  test(`reject Git ${field}: ${JSON.stringify(value)}`, () => {
    const result = generate({ ...git, [field]: value });
    assert.ok(result.errors[field]);
    assert.deepEqual(result.files, []);
  });
}

test("Git licenses require a real caller-supplied checksum; local licenses stay scoped", () => {
  for (const license of ["MIT", "BSD-3-Clause", "Apache-2.0", "GPL-2.0-only", "GPL-3.0-only"]) {
    assert.equal(Object.keys(validate({ ...git, license })).length, 0);
    assert.ok(validate({ ...git, license, licenseMd5: "" }).licenseMd5);
  }
  assert.ok(validate({ license: "Apache-2.0" }).license);
});

test("Git revision and checksum are canonical lowercase", () => {
  const bb = recipe(generate({ ...git, revision: "A".repeat(40), licenseMd5: "B".repeat(32) }));
  assert.ok(bb.includes(`SRCREV = "${"a".repeat(40)}"`));
  assert.ok(bb.includes(`md5=${"b".repeat(32)}`));
});

function unpackTar(bytes) {
  const decoder = new TextDecoder();
  const field = (header, start, length) => decoder.decode(header.slice(start, start + length)).split("\0")[0];
  const entries = [];
  for (let offset = 0; offset < bytes.length - 1024;) {
    const header = bytes.slice(offset, offset + 512);
    const storedChecksum = parseInt(field(header, 148, 6), 8);
    const checkHeader = header.slice(); checkHeader.fill(32, 148, 156);
    assert.equal(checkHeader.reduce((sum, byte) => sum + byte, 0), storedChecksum);
    assert.equal(field(header, 257, 6), "ustar");
    const size = parseInt(field(header, 124, 12), 8);
    const prefix = field(header, 345, 155);
    const name = field(header, 0, 100);
    entries.push({ path: prefix ? `${prefix}/${name}` : name, content: decoder.decode(bytes.slice(offset + 512, offset + 512 + size)) });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  assert.ok(bytes.slice(-1024).every(byte => byte === 0));
  return entries;
}

test("tar bundles round-trip all paths, bytes, long names and Unicode content", () => {
  const files = generate({ name: "a".repeat(60), version: "1".repeat(30) }).files;
  files.push({ path: "readme.txt", content: "A UTF-8 example: \u03c0\n" });
  const bytes = archive(files);
  assert.equal(bytes.length % 512, 0);
  assert.deepEqual(unpackTar(bytes), files);
  assert.deepEqual(archive(files), bytes);
  for (const path of ["../escape", "/absolute", "a/../../escape", "bad;name"]) {
    assert.throws(() => archive([{ path, content: "unsafe" }]), /Unsafe archive path/);
  }
});

test("setup commands pin both repositories and never use mutable HEAD or mixed release branches", () => {
  const commands = setupCommands();
  assert.ok(commands.includes(RELEASE.poky));
  assert.ok(commands.includes(RELEASE.bsp));
  assert.match(commands, /--branch yocto-5.0.13/);
  assert.match(commands, /--branch scarthgap/);
  assert.doesNotMatch(commands, /--branch master|--branch kirkstone|checkout HEAD/);
  for (const board of Object.keys(BOARDS)) {
    assert.match(localConfig(board), /RPI_USE_U_BOOT = "0"/);
    assert.match(localConfig(board), /IMAGE_FSTYPES = "wic.bz2 wic.bmap"/);
    assert.ok(localConfig(board).includes(`MACHINE = "${board}"`));
    const steps = guideSteps(board);
    assert.equal(steps.length, 10);
    assert.ok(steps[8].html.includes(BOARDS[board].serial));
    assert.ok(steps[7].code.includes(`images/${board}`));
    assert.ok(steps[3].code.includes(`MACHINE = "${board}"`));
    assert.match(steps[7].html, /erases the selected disk/);
    assert.match(steps[9].html, /not a claimed successful full Yocto build/);
  }
  assert.throws(() => localConfig("__proto__"), /Unsupported board/);
  assert.throws(() => guideSteps("raspberrypi5-64"), /Unsupported board/);
});

test("HTML only loads local relative assets; UI exposes key accessible surfaces", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(html, /lang="en"/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-describedby="checksum-help licenseMd5-error"/);
  assert.match(html, /href="\.\/styles.css"/);
  assert.match(html, /src="\.\/src\/app.js"/);
  assert.doesNotMatch(html, /<script[^>]*src="https?:/);
  assert.doesNotMatch(app, /\beval\s*\(|new Function|fetch\s*\(/);
  assert.match(app, /span.textContent = token/);
});

test("the MIT checksum is the documented Poky checksum, not generated from user input", async () => {
  const bb = recipe(generate({}));
  assert.match(bb, /0835ade698e0bcf8506ecda2f7b4f302/);
  const license = await readFile(new URL("../LICENSE", import.meta.url), "utf8");
  assert.match(license, /MIT License/);
  const bundleLicense = generate({}).files.find(file => file.path === "meta-myboard/COPYING").content;
  assert.ok(bundleLicense.trimEnd().endsWith(license.replace(/\r\n/g, "\n").trimEnd()));
});
