import { BOARDS, localConfig, setupCommands } from "./generator.js";

export function guideSteps(board) {
  if (!Object.hasOwn(BOARDS, board)) throw new Error("Unsupported board");
  return [
    {
      title: "Prepare a Linux build host",
      html: `<p>Build on a supported <strong>x86-64 Linux host</strong>; Ubuntu 22.04 LTS is the example here. Use a normal user, never root. Windows/macOS users: prefer a Linux machine or a suitably sized Linux VM. WSL2 has extra filesystem and host-setup considerations and is not the validated path here.</p><p>Allow <strong>at least 100 GB free disk space</strong>, preferably 150-200 GB on an SSD, and 16 GB RAM if possible (8 GB is a practical lower starting point). Multiple builds/caches need more. The first build may take hours and downloads many gigabytes. A Linux filesystem such as ext4 is recommended; do not put the build tree on NTFS, a network share or a path with spaces.</p><p>You can learn and build without a Pi. To flash later, you need the selected Pi, appropriate power supply, cooling, a microSD card (16 GB+), reader, and preferably keyboard/HDMI or a correctly wired serial adapter. <a href="https://docs.yoctoproject.org/5.0.13/ref-manual/system-requirements.html">Check the release's full host requirements</a>.</p>`,
      code: `# Ubuntu 22.04: install host tools (sudo is for apt, NOT bitbake)
sudo apt update
sudo apt install build-essential chrpath cpio debianutils diffstat file \\
  gawk gcc git iputils-ping libacl1 liblz4-tool locales python3 \\
  python3-git python3-jinja2 python3-pexpect python3-pip \\
  python3-subunit socat texinfo unzip wget xz-utils zstd
sudo locale-gen en_US.UTF-8
export LANG=en_US.UTF-8
df -h "$HOME"
free -h
`,
      check: "I have a supported Linux host, enough space, and a UTF-8 locale.",
    },
    {
      title: "Fetch a matching, pinned layer set",
      html: `<p><strong>Poky</strong> bundles BitBake, OpenEmbedded Core and a reference distribution. The Raspberry Pi layer adds the board-specific kernel, firmware and boot settings. These commands pin Poky to <strong>yocto-5.0.13</strong> and the BSP to a specific <strong>Scarthgap</strong> commit, rather than building moving branch heads.</p><p>The pinned BSP's <code>conf/layer.conf</code> declares <code>LAYERSERIES_COMPAT = scarthgap</code> (alongside nanbield) and requires only the <code>core</code> layer. Extra meta-openembedded layers are not needed for this minimal example. Its README mentions master generically; the pinned compatibility metadata is what matters here. A U-Boot mixin is recommended for Pi 5 U-Boot support, but this guide uses direct firmware boot instead.</p><p>Do not mix master, Kirkstone and Scarthgap layers. A newer release needs a newly reviewed set of pins. Detached HEAD messages are expected; they mean your source is pinned. Inspect repositories before building: build scripts execute locally, not in this browser.</p>`,
      code: setupCommands(),
      check: "Both repositories are at the stated revisions and the build environment is sourced.",
    },
    {
      title: "Understand bblayers.conf and choose MACHINE",
      html: `<p><code>source poky/oe-init-build-env build</code> creates <code>build/conf</code>, sets up your terminal and changes into <code>build</code>. Re-source it in every new terminal, from <code>~/yocto-rpi</code>. <code>bitbake-layers add-layer</code> edits <code>conf/bblayers.conf</code> for you; keep the generated Poky layer entries.</p><p>Your layer list should include absolute paths to <code>poky/meta</code>, <code>poky/meta-poky</code>, <code>poky/meta-yocto-bsp</code> and <code>meta-raspberrypi</code>. Do not paste someone else's absolute paths.</p><p>For <strong>${BOARDS[board].name}</strong>, the exact machine file is <code>meta-raspberrypi/conf/machine/${board}.conf</code>. The file name without <code>.conf</code> is MACHINE. Check that file and included settings in your pinned checkout. Pi 4's 32-bit machine is not the same target. Pi 5 uses <code>raspberrypi5</code>, not an invented <code>raspberrypi5-64</code>.</p>`,
      code: `# From ~/yocto-rpi/build
bitbake-layers show-layers
cat ../meta-raspberrypi/conf/layer.conf
cat ../meta-raspberrypi/conf/machine/${board}.conf
cat ../meta-raspberrypi/conf/machine/include/rpi-base.inc
`,
      check: "I can identify every enabled layer and my board's exact machine file.",
    },
    {
      title: "Set local.conf for your board",
      html: `<p>Edit <code>build/conf/local.conf</code> in a text editor. <strong>Merge these assignments; do not overwrite the complete file.</strong> Replace the existing MACHINE line (often qemux86-64). <code>TOPDIR</code> means this build directory; <code>TMPDIR</code> holds work/output, <code>DL_DIR</code> caches downloads, and <code>SSTATE_DIR</code> caches reusable build tasks.</p><p>Keep <code>TMPDIR</code> on a local Linux filesystem, with no spaces in its path. Use separate directories such as <code>build-pi4</code> and <code>build-pi5</code> when switching hardware; each needs its own configuration and layer setup. Never share one TMPDIR across them. Downloads and sstate can be shared.</p><p><strong>Learning-only login:</strong> debug-tweaks permits root login without a password. Use only an isolated local device with console access. Do not expose it to an untrusted network. For deployment, remove debug-tweaks and provision users/password hashes or keys using Yocto's user-management classes. This site never asks for credentials.</p>`,
      code: localConfig(board),
      check: "My local.conf names the right board and I understand the insecure learning-only login.",
    },
    {
      title: "Build a baseline image first",
      html: `<p>Start with <code>core-image-minimal</code>, a small console image, before adding your own application. It is not Raspberry Pi OS and does not come with a desktop, apt workflow, configured Wi-Fi or SSH access. BitBake downloads sources, builds a cross-toolchain, compiles packages and creates the image.</p><p>If your machine runs out of memory, add <code>BB_NUMBER_THREADS = "2"</code> and <code>PARALLEL_MAKE = "-j2"</code> to local.conf and retry. Actual memory needs depend on recipes. Avoid deleting downloads or caches as a first response to a failure.</p>`,
      code: `# From the initialized build directory
bitbake -e core-image-minimal | grep '^MACHINE='
bitbake core-image-minimal
# After success, inspect outputs rather than guessing a filename:
ls -lh tmp/deploy/images/${board}/
`,
      check: "The baseline image built successfully, or I know how to inspect its first error.",
    },
    {
      title: "Add your generated package",
      html: `<p>Return to the workbench, generate the <strong>local C example</strong> first, and download the archive. Inspect it before using it. Place the archive in <code>~/yocto-rpi</code> and extract it there (not inside <code>build</code>). It contains <code>meta-myboard/conf/layer.conf</code>, your recipe/source, a custom image recipe, a local.conf snippet and build commands.</p><p>After inspecting an archive named <code>hello-pi-starter.tar</code>, run the commands below. If you changed the package name, use the generated <code>build-commands.txt</code> instead. If you already have <code>meta-myboard</code>, merge files carefully; extraction can overwrite matching files.</p><p>For Git sources, verify the commit is on the named branch, the source path exists, the project truly compiles as one file, and its actual license file's <code>md5sum</code> matches your input. Selecting MIT in a dropdown does not relicense someone else's code. <code>DEPENDS</code> supplies build-time dependencies; <code>RDEPENDS:\${PN}</code> is for additional runtime dependencies you add manually.</p>`,
      code: `# Run the first two commands from ~/yocto-rpi; use your actual download name.
tar -tf hello-pi-starter.tar
tar -xf hello-pi-starter.tar
# From ~/yocto-rpi/build with the build environment sourced:
bitbake-layers add-layer ../meta-myboard
bitbake-layers show-recipes hello-pi
bitbake hello-pi
`,
      check: "BitBake sees and builds my package. I have reviewed its source and license.",
    },
    {
      title: "Put the package into an image",
      html: `<p>Building a recipe alone does <em>not</em> put it on your card. Choose <strong>one</strong> of these approaches. For a quick experiment, add <code>IMAGE_INSTALL:append = " hello-pi"</code> to local.conf (keep the initial space), then rebuild <code>core-image-minimal</code>.</p><p>For a cleaner reusable image, use the generated <code>meta-myboard/recipes-core/images/my-rpi-image.bb</code> and build <code>my-rpi-image</code> instead. It requires core-image-minimal and appends your package. Keep MACHINE and host-specific cache settings in local.conf; keep product package choices in the image recipe. Omit the local.conf IMAGE_INSTALL append when using this approach.</p><p>Inspect the new image's <code>.manifest</code> to confirm the package was included. Rebuild the image after any package changes, then reflash or use your own deliberate deployment strategy. Existing cards do not update automatically.</p>`,
      code: `# Option A, after appending IMAGE_INSTALL in local.conf:
bitbake core-image-minimal
# Option B, using the generated image recipe instead:
# bitbake my-rpi-image

# Look for your package in the corresponding image manifest:
grep '^hello-pi ' tmp/deploy/images/${board}/core-image-minimal-${board}.rootfs.manifest
# If your output naming differs, list *.manifest and inspect the matching image.
`,
      check: "My package appears in the image manifest, not just in a successful package build.",
    },
    {
      title: "Identify the disk image and flash safely",
      html: `<p>With the suggested TMPDIR, look under <code>build/tmp/deploy/images/${board}/</code>. Find the latest successful image's <strong><code>.wic.bz2</code></strong> and its matching <code>.wic.bmap</code>. Exact names may include timestamps and <code>.rootfs</code>; symlinks often point to the latest artifact. For a custom TMPDIR, use that directory instead. Do not flash a kernel, rootfs tarball, manifest, or bmap by itself.</p><p><strong>Flashing erases the selected disk.</strong> Back up the card, unplug unrelated external drives, identify it by capacity/model, and double-check the destination. Never guess a device path or select your computer's system disk.</p><p>Beginner route: decompress the chosen file with <code>bunzip2 -k</code>, then open <a href="https://www.raspberrypi.com/software/">Raspberry Pi Imager</a>, choose <strong>Use custom</strong>, select the resulting <code>.wic</code> file (show all files if necessary), and carefully choose the SD card. If your Imager does not accept .wic, rename a copy of that disk image to .img, not a tarball. Skip Raspberry Pi OS customisation: it is not guaranteed to apply to Yocto. Write, allow verification to finish, and safely eject.</p><p>Linux alternative: <code>bmaptool copy</code> can use the matching compressed image and bmap, as described in the BSP guide. No destructive disk command is prefilled here. Verify hardware and artifacts yourself.</p>`,
      code: `# Read-only inspection from build/:
ls -lh tmp/deploy/images/${board}/*wic*
# Then in the output directory:
cd tmp/deploy/images/${board}
# Decompress ONE actual image, substituting its exact filename:
# bunzip2 -k YOUR-EXACT-IMAGE.wic.bz2
# Select the resulting .wic in your flashing tool.
`,
      check: "I identified the full disk image and can verify the card before any erase.",
    },
    {
      title: "First boot: console, then networking",
      html: `<p>With the Pi powered off, insert the card. Connect HDMI/keyboard before power, or use a correctly configured 3.3 V TTL serial connection. Use a suitable board-specific power supply and allow time for the first boot. Pi 5 may need current bootloader EEPROM firmware and adequate cooling. This guide does not modify EEPROM.</p><p>The pinned machine's default serial console is <strong>${BOARDS[board].serial} at 115200 baud</strong>. Enable <code>ENABLE_UART = "1"</code> if needed and rebuild/reflash. <strong>Pi 5's dedicated debug UART connector is not the Pi 4 GPIO UART wiring.</strong> Consult the board documentation, use 3.3 V logic (never RS-232/5 V), cross TX/RX, share ground and do not connect adapter power. No serial hardware is required to read this guide.</p><p>With the isolated debug-tweaks image, log in as <code>root</code> locally, without a password. Try the commands below on the target, not on your laptop. For the data template, use <code>cat /usr/share/hello-pi/message.txt</code> instead.</p><p>Networking is a separate configuration task: Ethernet may obtain DHCP if the image's network configuration enables it. Use <code>ip addr</code> and <code>ip route</code> to inspect. Wi-Fi firmware, regulatory settings and network credentials must be configured deliberately; nothing here asks for them. core-image-minimal does not promise SSH. Add/configure a server and secure users only after local boot works.</p>`,
      code: `# On the Raspberry Pi console:
uname -m
cat /etc/os-release
/usr/bin/hello-pi
ip addr
ip route
dmesg | tail -n 40
# Shut down cleanly before removing power:
poweroff
`,
      check: "I know how to access a local console and check whether my package works.",
    },
    {
      title: "Read failures one layer at a time",
      html: `<dl class="troubleshooting"><dt>Nothing PROVIDES / incompatible layer</dt><dd>Confirm all layers are enabled with show-layers, that LAYERSERIES_COMPAT includes scarthgap, and that the recipe filename matches. Do not suppress compatibility checks to force a mismatch.</dd><dt>Fetch failed / SRCREV not found</dt><dd>Check network/proxy/DNS, exact repository URL, commit and branch. Confirm access without putting credentials in recipes. An HTTPS URL does not prove the code is trustworthy.</dd><dt>License checksum mismatch</dt><dd>Read the actual license at the pinned commit. Run md5sum on that exact file. Update the declaration only after reviewing what changed; do not copy an arbitrary expected checksum to silence QA.</dd><dt>Compile or install failed</dt><dd>Read the first error in the task log. Verify S, B, filenames, build flags and dependencies. Multi-file projects need a different build template. The recipe must install under \${D}; never write to host /usr directly.</dd><dt>Installed but not shipped / empty package</dt><dd>Check do_install destinations against FILES:\${PN}. Our data template explicitly includes its share directory. Do not disable QA to hide missing files.</dd><dt>No space / process killed</dt><dd>Use df -h and free -h. Increase storage/RAM or reduce parallelism. Preserve downloads/sstate where possible; tmp can be very large.</dd><dt>No boot / blank screen</dt><dd>Check power, card verification, correct MACHINE, full .wic disk image, current board firmware and monitor/serial configuration. Pi 4 and Pi 5 images are not interchangeable. Inspect the boot partition and serial log before changing recipes.</dd><dt>Command missing on target</dt><dd>Check the image manifest, IMAGE_INSTALL, selected image file and that you flashed the newly built artifact. Building the package alone is not enough.</dd></dl><p>Logs live below <code>tmp/work/.../&lt;recipe&gt;/&lt;version&gt;/temp/log.do_*</code>. BitBake prints the failing log path. Read it before cleaning or rebuilding everything. These are documented starter combinations, <strong>not a claimed successful full Yocto build or physical-board test</strong>.</p>`,
      code: `# From build/; replace hello-pi with your recipe name:
bitbake-layers show-layers
bitbake-layers show-recipes hello-pi
bitbake -e hello-pi | grep -E '^(S|B|WORKDIR|DEPENDS)='
# The task failure output names the log.do_* file to inspect.
`,
      check: "I can find the failing task log and separate recipe, image and board problems.",
    },
  ];
}
