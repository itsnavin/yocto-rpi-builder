export const RELEASE = Object.freeze({
  name: "Scarthgap 5.0.13",
  branch: "scarthgap",
  poky: "529843b1c189ab7b133b7fdf197d4b2a4b71a6db",
  bsp: "018d44467c4f09eb63f8ea5e86e85d755250cf89",
});

export const BOARDS = Object.freeze({
  "raspberrypi4-64": { name: "Raspberry Pi 4", serial: "ttyS0", architecture: "Cortex-A72 / AArch64" },
  raspberrypi5: { name: "Raspberry Pi 5", serial: "ttyAMA10", architecture: "Cortex-A76 / AArch64" },
});

export const DEFAULTS = Object.freeze({
  board: "raspberrypi4-64", name: "hello-pi", version: "1.0",
  summary: "A small hello from my Raspberry Pi",
  description: "My first custom package for a Yocto Linux image.",
  template: "c", source: "local", depends: "", license: "MIT",
  gitUrl: "", branch: "main", revision: "", sourceFile: "main.c",
  licenseFile: "LICENSE", licenseMd5: "",
});

const scaffoldLicense = `This license covers the generated layer scaffold and bundled MIT examples.
It does not relicense Git source or authorized proprietary replacements.

MIT License

Copyright (c) 2026 yocto-rpi-builder contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const licenses = ["MIT", "BSD-3-Clause", "Apache-2.0", "GPL-2.0-only", "GPL-3.0-only", "CLOSED"];
const namePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const pathPattern = /^[A-Za-z0-9_][A-Za-z0-9_.+-]*(?:\/[A-Za-z0-9_][A-Za-z0-9_.+-]*)*$/;

function safePath(value, max = 180) {
  return typeof value === "string" && value.length <= max &&
    pathPattern.test(value) && !value.split("/").some(part => part === "." || part === "..");
}

function safeText(value, max) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max &&
    !/["$\\`\x00-\x1f\x7f]/.test(value);
}

export function validate(input) {
  const x = { ...DEFAULTS, ...input };
  const errors = {};
  if (!Object.hasOwn(BOARDS, x.board)) errors.board = "Choose a supported 64-bit Raspberry Pi.";
  if (typeof x.name !== "string" || x.name.length > 60 || !namePattern.test(x.name))
    errors.name = "Use lowercase letters, digits and internal hyphens (start with a letter). No spaces or underscores.";
  if (typeof x.version !== "string" || !/^[0-9]+(?:\.[0-9]+){0,3}$/.test(x.version) || x.version.length > 30)
    errors.version = "Use a numeric version such as 1.0 or 2.1.3.";
  if (!safeText(x.summary, 120)) errors.summary = "Enter 1-120 characters; no quotes, backslashes, dollar signs, backticks or line breaks.";
  if (!safeText(x.description, 500)) errors.description = "Enter 1-500 characters; no quotes, backslashes, dollar signs, backticks or line breaks.";
  if (!["c", "cpp", "data"].includes(x.template)) errors.template = "Choose C, C++ or a data package.";
  if (!["local", "git"].includes(x.source)) errors.source = "Choose local files or Git.";
  if (typeof x.depends !== "string" || x.depends.length > 300 ||
      !/^(?:(?:virtual\/)?[a-z0-9][a-z0-9+.-]*(?: +(?:virtual\/)?[a-z0-9][a-z0-9+.-]*)*)?$/.test(x.depends.trim()) ||
      x.depends.includes("..") || /[\r\n]/.test(x.depends))
    errors.depends = "Use space-separated recipe names, for example zlib openssl or virtual/libgl. No shell syntax.";
  if (!licenses.includes(x.license)) errors.license = "Choose a supported license identifier.";
  if (x.source === "local" && !["MIT", "CLOSED"].includes(x.license))
    errors.license = "Generated local examples are MIT; use CLOSED only for your own authorized proprietary source.";
  if (x.source === "git") {
    // A deliberately narrow URL grammar keeps BitBake URI parameters out of user data.
    if (typeof x.gitUrl !== "string" || x.gitUrl.length > 240 ||
        !/^https:\/\/[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\/[A-Za-z0-9_~.-]+(?:\/[A-Za-z0-9_~.-]+)*$/.test(x.gitUrl) ||
        x.gitUrl.split("/").some(part => part === "." || part === ".."))
      errors.gitUrl = "Use a public HTTPS Git URL with no credentials, query, port, fragment or URI parameters.";
    if (typeof x.branch !== "string" || x.branch.length > 100 ||
        !/^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(x.branch) ||
        x.branch.includes("..") || x.branch.includes("//") ||
        x.branch.split("/").some(part => !part || part.startsWith(".") || part.endsWith(".") || part.endsWith(".lock")))
      errors.branch = "Enter a Git branch such as main or release/1.0, without spaces or special syntax.";
    if (typeof x.revision !== "string" || !/^[a-fA-F0-9]{40}$/.test(x.revision))
      errors.revision = "Paste the full 40-character commit SHA from that branch; not HEAD, a tag or AUTOREV.";
    if (!safePath(x.sourceFile)) errors.sourceFile = "Use a relative file path such as src/main.c. No spaces, traversal or shell syntax.";
    else if (x.template === "c" && !x.sourceFile.endsWith(".c")) errors.sourceFile = "The single-file C template needs a .c source file.";
    else if (x.template === "cpp" && !/\.(cpp|cc|cxx)$/.test(x.sourceFile)) errors.sourceFile = "The C++ template needs a .cpp, .cc or .cxx file.";
    if (x.license !== "CLOSED") {
      if (!safePath(x.licenseFile)) errors.licenseFile = "Enter the license path relative to the Git checkout, for example COPYING.";
      if (typeof x.licenseMd5 !== "string" || !/^[a-fA-F0-9]{32}$/.test(x.licenseMd5))
        errors.licenseMd5 = "Run md5sum on the actual license file at this commit and paste its 32-character checksum.";
    }
  }
  return errors;
}

export function setupCommands() {
  return `# Linux Bash; run as a normal user, not root
mkdir -p "$HOME/yocto-rpi"
cd "$HOME/yocto-rpi"
git clone --branch yocto-5.0.13 https://git.yoctoproject.org/poky
git -C poky checkout --detach ${RELEASE.poky}
git clone --branch scarthgap https://github.com/agherzan/meta-raspberrypi.git
git -C meta-raspberrypi checkout --detach ${RELEASE.bsp}
source poky/oe-init-build-env build
# You are now in ~/yocto-rpi/build
bitbake-layers add-layer ../meta-raspberrypi
bitbake-layers show-layers
`;
}

export function localConfig(board) {
  if (!Object.hasOwn(BOARDS, board)) throw new Error("Unsupported board");
  return `# Merge into build/conf/local.conf; do not replace the whole file.
# Replace an existing MACHINE assignment rather than keeping two.
MACHINE = "${board}"
TMPDIR = "\${TOPDIR}/tmp"
DL_DIR = "\${TOPDIR}/../downloads"
SSTATE_DIR = "\${TOPDIR}/../sstate-cache"
IMAGE_FSTYPES = "wic.bz2 wic.bmap"
# Direct firmware boot; this guide does not configure U-Boot.
RPI_USE_U_BOOT = "0"
# Local learning device only: permits root login with no password.
# Disconnect from untrusted networks; NEVER ship with debug-tweaks.
EXTRA_IMAGE_FEATURES = "debug-tweaks"
# Optional local serial debugging (check board-specific wiring first):
# ENABLE_UART = "1"
`;
}

export function generate(input) {
  const x = { ...DEFAULTS, ...input };
  const errors = validate(x);
  if (Object.keys(errors).length) return { errors, files: [] };
  const root = `meta-myboard/recipes-apps/${x.name}`;
  const local = x.source === "local";
  const data = x.template === "data";
  const sourceFile = local ? ({ c: "main.c", cpp: "main.cpp", data: "message.txt" })[x.template] : x.sourceFile;
  let recipe = `# Scaffold for Yocto ${RELEASE.name}; review and build-test before use.\n`;
  recipe += `SUMMARY = "${x.summary.trim()}"\nDESCRIPTION = "${x.description.trim()}"\nLICENSE = "${x.license}"\n`;
  if (x.license !== "CLOSED") {
    recipe += local
      ? 'LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"\n'
      : `LIC_FILES_CHKSUM = "file://${x.licenseFile};md5=${x.licenseMd5.toLowerCase()}"\n`;
  }
  recipe += local
    ? `\nSRC_URI = "file://${sourceFile}"\nS = "\${WORKDIR}"\n`
    : `\nSRC_URI = "git://${x.gitUrl.slice(8)};protocol=https;branch=${x.branch}"\nSRCREV = "${x.revision.toLowerCase()}"\nS = "\${WORKDIR}/git"\n`;
  recipe += `B = "\${WORKDIR}/build"\nDEPENDS = "${x.depends.trim().split(/ +/).filter(Boolean).join(" ")}"\n\ndo_configure[noexec] = "1"\n`;
  if (data) {
    recipe += `\ninherit allarch\n\ndo_compile[noexec] = "1"\n\ndo_install() {
    install -d "\${D}\${datadir}/\${PN}"
    install -m 0644 "\${S}/${sourceFile}" "\${D}\${datadir}/\${PN}/message.txt"
}

FILES:\${PN} = "\${datadir}/\${PN}"
`;
  } else {
    const compiler = x.template === "cpp" ? "${CXX} ${CXXFLAGS}" : "${CC} ${CFLAGS}";
    recipe += `\ndo_compile() {
    ${compiler} \${CPPFLAGS} "\${S}/${sourceFile}" \${LDFLAGS} -o "\${B}/\${PN}"
}

do_install() {
    install -d "\${D}\${bindir}"
    install -m 0755 "\${B}/\${PN}" "\${D}\${bindir}/\${PN}"
}
`;
  }
  const files = [
    { path: `${root}/${x.name}_${x.version}.bb`, content: recipe },
    { path: "meta-myboard/conf/layer.conf", content: `BBPATH .= ":\${LAYERDIR}"
BBFILES += "\${LAYERDIR}/recipes-*/*/*.bb \${LAYERDIR}/recipes-*/*/*.bbappend"
BBFILE_COLLECTIONS += "myboard"
BBFILE_PATTERN_myboard = "^\${LAYERDIR}/"
BBFILE_PRIORITY_myboard = "6"
LAYERSERIES_COMPAT_myboard = "scarthgap"
LAYERDEPENDS_myboard = "core"
` },
    { path: "local.conf.snippet", content: `${localConfig(x.board)}\n# Use this OR the custom image below, not both approaches.\nIMAGE_INSTALL:append = " ${x.name}"\n` },
    { path: "meta-myboard/recipes-core/images/my-rpi-image.bb", content: `SUMMARY = "My learning image for Raspberry Pi"
LICENSE = "MIT"
require recipes-core/images/core-image-minimal.bb
IMAGE_INSTALL:append = " ${x.name}"
` },
    { path: "build-commands.txt", content: `# Extract the archive inside ~/yocto-rpi (not build/).
# Then from ~/yocto-rpi/build with the environment sourced:
bitbake-layers add-layer ../meta-myboard
bitbake-layers show-recipes ${x.name}
bitbake ${x.name}
# Merge local.conf.snippet into conf/local.conf, OR use the custom image.
# Option A: IMAGE_INSTALL in local.conf, then:
bitbake core-image-minimal
# Option B: omit IMAGE_INSTALL in local.conf, then:
# bitbake my-rpi-image
# On the target after boot:
${data ? `cat /usr/share/${x.name}/message.txt` : `/usr/bin/${x.name}`}
` },
    { path: "meta-myboard/COPYING", content: scaffoldLicense },
  ];
  if (local) {
    const header = x.license === "MIT" ? "// SPDX-License-Identifier: MIT\n" : "// Proprietary example: replace with authorized source.\n";
    const content = data ? "Hello from a custom Yocto data package!\n"
      : x.template === "c" ? `${header}#include <stdio.h>\n\nint main(void) {\n    puts("Hello from my Raspberry Pi!");\n    return 0;\n}\n`
        : `${header}#include <iostream>\n\nint main() {\n    std::cout << "Hello from my Raspberry Pi!\\n";\n    return 0;\n}\n`;
    files.splice(1, 0, { path: `${root}/files/${sourceFile}`, content });
  }
  return { errors: {}, files };
}

// POSIX ustar: deterministic, dependency-free bundles with preserved paths.
export function archive(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  for (const file of files) {
    if (!safePath(file.path, 255)) throw new Error("Unsafe archive path");
    const body = encoder.encode(file.content);
    const header = new Uint8Array(512);
    const put = (offset, value) => header.set(encoder.encode(value), offset);
    if (encoder.encode(file.path).length <= 100) put(0, file.path);
    else {
      const slash = file.path.lastIndexOf("/");
      const prefix = file.path.slice(0, slash);
      const name = file.path.slice(slash + 1);
      if (slash < 0 || encoder.encode(prefix).length > 155 || encoder.encode(name).length > 100)
        throw new Error("Archive path is too long");
      put(0, name); put(345, prefix);
    }
    put(100, "0000644\0"); put(108, "0000000\0"); put(116, "0000000\0");
    put(124, body.length.toString(8).padStart(11, "0") + "\0");
    put(136, "00000000000\0"); put(148, "        "); put(156, "0");
    put(257, "ustar\0"); put(263, "00");
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    put(148, checksum.toString(8).padStart(6, "0") + "\0 ");
    chunks.push(header, body, new Uint8Array((512 - body.length % 512) % 512));
  }
  chunks.push(new Uint8Array(1024));
  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}
