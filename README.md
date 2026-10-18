# Pi Foundry / yocto-rpi-builder

A beginner-friendly, browser-only Yocto recipe workbench and an end-to-end guide
to preparing a custom **64-bit Raspberry Pi 4 or Pi 5** Linux image.

**Live application:** <https://itsnavin.github.io/yocto-rpi-builder/>.
Published through GitHub Pages with desktop/mobile live smoke checks.

## What it does

- Generates standalone **C**, **C++**, and **data-file** package recipes from local
  examples or a public HTTPS Git repository with a pinned commit.
- Also generates **Make**, **Autotools**, and **CMake** project recipes with complete
  local C examples or an existing Git project. The basics tab explains source layout,
  cross-compilation, task ownership, staging/install paths, and dependencies.
- Includes step-by-step **devshell** debugging for Make, Autotools and CMake in
  The basics tab; each generated project archive contains `devshell-steps.txt`.
- Includes SUMMARY, DESCRIPTION, LICENSE, license checksums where required,
  SRC_URI/SRCREV, release-appropriate source/build paths, DEPENDS,
  do_compile/do_install, and IMAGE_INSTALL.
- Provides safe text previews, lightweight syntax highlighting, clipboard copy,
  individual downloads, and a deterministic POSIX tar archive preserving a
  complete starter layer's paths.
- Generates `meta-myboard/conf/layer.conf`, a scoped scaffold `COPYING`, an application recipe and local source
  when applicable, `my-rpi-image.bb`, a local.conf snippet, and build commands.
- Explains host setup, pinned layers, MACHINE, configuration, baseline and custom
  images, artifact selection, safe flashing, first boot, serial/network debugging,
  and common failures. Includes a glossary, quiz, and visit-only checkpoints.
- Has no backend, analytics, remote scripts, external fonts, runtime dependencies,
  credential collection, source fetching, or online code execution.

## Local preview and checks

Install **Node.js 22 or later**. The site and unit tests have no runtime
dependencies. Playwright is a development-only dependency for browser checks.

```sh
npm test
npm run build
npm start
```

To run the browser suite (desktop and mobile Chromium), also run:

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

Open <http://127.0.0.1:4173>. Stop the preview with Ctrl+C. Do not open index.html
through `file://`; browser module loading requires HTTP. `npm run build` copies
only the static site into `dist/`. All asset URLs are relative so the site works
under a GitHub Pages project subpath.

The Node test suite covers all 24 board/template/source combinations, license
handling, input/URI/path/metadata injection edge cases, compiler/install flags,
image/config consistency, branch pins, deterministic tar checksums/round-trips,
long archive paths, and core accessibility/static asset contracts. The browser
suite exercises templates, validation, Git licensing, board-specific config,
downloads, keyboard tabs, quiz behavior, text-only rendering and responsive
overflow. On Linux, three additional native smoke tests compile, stage-install and
run the bundled Make/Autotools/CMake C examples using host tools (`cc`, `make`,
`autoreconf`, `automake`, `cmake`). Missing tools fail explicitly; install your
distribution's build-essential, autoconf, automake and cmake packages if needed.
These native tests skip on Windows/macOS. They check source/build file coherence,
**not BitBake cross-compilation or physical Raspberry Pi execution**.

For a manual browser check: switch both boards; try all six templates and both
source modes; enter invalid names, source paths, URLs and missing Git checksums;
ensure stale files cannot be copied/downloaded; check preview/copy and extract
the archive; navigate tabs with arrows/Home/End; read guide code with keyboard
focus; check mobile layout and the quiz. Clipboard access requires a secure
context (HTTPS or localhost); failures display a manual-copy instruction.

## Release and hardware contract

Research references were inspected on **2026-10-18**. This intentionally targets a
specific Scarthgap LTS snapshot, not whatever the latest release happens to be:

| Component | Pin |
| --- | --- |
| Poky / Yocto | **5.0.13**, tag `yocto-5.0.13`, Scarthgap series |
| Poky commit | `529843b1c189ab7b133b7fdf197d4b2a4b71a6db` |
| meta-raspberrypi | Scarthgap commit `018d44467c4f09eb63f8ea5e86e85d755250cf89` |
| Pi 4 64-bit MACHINE | `raspberrypi4-64` |
| Pi 5 64-bit MACHINE | `raspberrypi5` |
| Boot | Direct Raspberry Pi firmware; `RPI_USE_U_BOOT = "0"` |
| Guide host | Ubuntu 22.04 LTS x86-64, Linux filesystem, Bash |

The pinned BSP's `conf/layer.conf` declares Scarthgap compatibility and a required
`core` dependency. It recommends an additional U-Boot mixin; this guide does not
enable U-Boot. It does not require extra meta-openembedded layers for the minimal
path. Inspect the pinned metadata rather than copying its generic README's
`master` example.

**Test coverage:** generator/static tests, three Linux-only native source-build
smoke checks and 18 desktop/mobile Chromium browser checks. CI runs them before
publishing. Native source tests do not validate Yocto recipe execution.
The source/release/machine definitions are documentation-checked only:
no successful full Yocto build or physical Pi boot is claimed. Application tests
do not establish board support. A pinned release is reproducible input
metadata, not a guarantee that all upstream downloads remain available or that
old snapshots contain current security fixes. Review updates before deployment.

For this release, local `file://` sources unpack into `${WORKDIR}`, and Git into
`${WORKDIR}/git`. Local build-system projects use `${WORKDIR}/project`. Plain Make
uses `B = "${S}"` for its in-source Makefile; single-file and class-managed builds
use a separate build directory. All installation is staged under `${D}`.
Do not carry these unpacking conventions into newer Yocto releases
without consulting their migration notes.

## License and source boundaries

Local sample code is MIT-licensed under this repository's LICENSE. Its recipe
references the actual Poky common MIT license and the checksum used by
[Poky's pinned hello-single example](https://github.com/yoctoproject/poky/blob/529843b1c189ab7b133b7fdf197d4b2a4b71a6db/meta-skeleton/recipes-skeleton/hello-single/hello_1.0.bb).
For Git source, users must supply the actual license path and MD5 from the pinned
checkout. The site does not fabricate or remotely verify checksums. `CLOSED` is
only for authorized proprietary source; it is not a license-compliance shortcut.

The C/C++ templates compile **one standalone source file**. Select a project
template for Make, Autotools or CMake; Meson is outside this tool's scope. Adapt for
libraries, linker flags, runtime dependencies, services and complex licensing.
DEPENDS alone does not link libraries. The data template installs one file as
`/usr/share/<package>/message.txt`.

## Build-system templates (Scarthgap)

All three local project templates include `main.c` and name the executable after
the package. Their recipes fetch `file://project/` and set
`S = "${WORKDIR}/project"`; source/build files live under the recipe's
`files/project/` directory. Use the website preview to copy the full recipe and
build files, or download the tar to keep paths intact.

| Choice | Bundled build files | Recipe tasks and installation |
| --- | --- | --- |
| Make | `Makefile` | `B = "${S}"`, no configure task; explicit `oe_runmake` compilation and `oe_runmake 'DESTDIR=${D}' install` |
| Autotools | `configure.ac`, `Makefile.am` | `inherit autotools`; class regenerates/configures, builds and installs with DESTDIR |
| CMake | `CMakeLists.txt` | `inherit cmake`; class generates cross-toolchain settings, configures, builds and stages install |

The Makefile honors CC/CPPFLAGS/CFLAGS/LDFLAGS, prefix, bindir and DESTDIR. Recipe
EXTRA_OEMAKE passes Yocto's target variables; do not hardcode host gcc. Autotools
and CMake classes supply native build tools, target compiler/sysroot configuration
and separate `${B}` directories. Do not override their do_configure/do_compile/
do_install tasks unnecessarily. Use EXTRA_OECONF or EXTRA_OECMAKE for actual
upstream options. GNUInstallDirs in CMake and bin_PROGRAMS in Automake ensure the
executable has an install rule.

DESTDIR is a temporary packaging root, not the final prefix. Installing into
`${D}/usr/bin` produces `/usr/bin` on the target, without changing the host's
`/usr`. `DEPENDS += "zlib"` supplies build headers/libraries; the build files still
need the appropriate library linkage. Additional runtime packages belong in
`RDEPENDS:${PN}`; shared-library dependencies are often auto-detected.

Git project modes consume the whole checkout at `${WORKDIR}/git`; the per-file
source field is disabled and unused. The upstream repository must contain its own
matching build/install files. Adapt S for nested layouts and verify executable
names, install paths and package FILES before using the generated target command.
The tool never invents missing upstream files or downloads/runs upstream code.
The pinned [Autotools class](https://github.com/yoctoproject/poky/blob/529843b1c189ab7b133b7fdf197d4b2a4b71a6db/meta/classes-recipe/autotools.bbclass)
and [CMake class](https://github.com/yoctoproject/poky/blob/529843b1c189ab7b133b7fdf197d4b2a4b71a6db/meta/classes-recipe/cmake.bbclass)
are the source of truth for task behavior. These are source scaffolds, not
claimed tested BitBake recipes or images.

## Devshell compilation (Scarthgap)

The **The basics > Compile inside a Yocto devshell** section has separate,
copyable Make, Autoconf/Automake and CMake workflows. Project downloads contain
the same steps in `devshell-steps.txt`, with the selected recipe name.

1. In the original Linux terminal, initialize the existing build directory and
   prepare the recipe. Force configure (Autotools/CMake), then compile and install
   through BitBake; stop at failures. Plain Make has no configure script.
2. Inspect expanded `S`, `B`, `D`, `T`, compiler/flags and sysroot with
   `bitbake -e <recipe>`; record the actual absolute T path. Enter with
   `bitbake <recipe> -c devshell`. The shell normally starts in S, not B.
3. In devshell, inspect the current `run.do_*` scripts in that recorded T directory.
   Execute the configure/compile scripts in order to reuse the exact BitBake
   environment/flags. Do not assume metadata such as B/T is exported to the shell,
   source a task script, invoke host gcc or guess out-of-tree configure commands.
4. Inspect run.do_install, but run installation via BitBake outside devshell to
   preserve pseudo/fakeroot ownership tracking. D is staging, not host/target
   installation. Never use sudo make install.
5. Persist experimental changes in the layer, a source patch or an upstream Git
   commit/SRCREV update. Exit devshell, use `bitbake <recipe> -C configure` for
   Autotools/CMake or `-C compile` for Make, then rebuild the selected image.
   Script replay alone does not update task stamps or package/image outputs.

The lesson explains OE_TERMINAL/interactive host requirements, missing task scripts
due to stamps/sstate, Make's noexec configure task, native tool/sysroot failures
and the difference between in-source Make and class-managed separate build
directories. See the [release-specific devshell documentation](https://docs.yoctoproject.org/5.0.13/dev-manual/development-shell.html)
and [pinned implementation](https://github.com/yoctoproject/poky/blob/529843b1c189ab7b133b7fdf197d4b2a4b71a6db/meta/classes-global/devshell.bbclass).
**No actual BitBake devshell execution or ARM cross-compilation was validated.**
Generator/browser tests and Linux native source smoke tests do not establish that.

The generator deliberately accepts a narrow syntax: lowercase hyphenated package
names, numeric versions, safe relative paths, plain single-line metadata, and
public HTTPS Git URLs without credentials or extra URI parameters. It does not
fetch these URLs. A later BitBake build executes upstream build tasks locally:
review sources, revisions and licenses before building. MD5 here detects license
text changes; it is not an authenticity/security guarantee.

The guide uses `debug-tweaks` for **isolated local learning only**, enabling
passwordless root console login. Remove it and provision secure users before any
deployment or untrusted network connection. No SSH/Wi-Fi/desktop is promised.
Flashing erases storage; the guide never supplies a guessed destructive device
path or runs flashing commands.

## Publishing to GitHub Pages

`.github/workflows/pages.yml` uses an explicit Ubuntu 24.04 CI runner and current
versioned Actions. It tests and builds on pull requests, and deploys on
pushes to `main` or manual runs on `main`. In repository **Settings > Pages**,
choose **GitHub Actions** as the source. The workflow uploads `dist/` and deploys
through the `github-pages` environment. No secrets or third-party hosting account
are required. Repository/environment policy may require an owner's approval.

After the workflow succeeds, verify the live page and its `src/app.js` and
`styles.css` URLs under the project subpath. The production address should be:
<https://itsnavin.github.io/yocto-rpi-builder/>.

## Authoritative references

- [Yocto 5.0.13 Quick Build](https://docs.yoctoproject.org/5.0.13/brief-yoctoprojectqs/index.html)
- [Host requirements](https://docs.yoctoproject.org/5.0.13/ref-manual/system-requirements.html)
- [New recipes](https://docs.yoctoproject.org/5.0.13/dev-manual/new-recipe.html)
- [Custom images](https://docs.yoctoproject.org/5.0.13/dev-manual/customizing-images.html)
- [Pinned Poky source](https://github.com/yoctoproject/poky/tree/529843b1c189ab7b133b7fdf197d4b2a4b71a6db)
- [Pinned BSP source and machine definitions](https://github.com/agherzan/meta-raspberrypi/tree/018d44467c4f09eb63f8ea5e86e85d755250cf89)
- [BSP guide](https://meta-raspberrypi.readthedocs.io/en/latest/) (latest; reconcile with pins)
- [Raspberry Pi flashing documentation](https://www.raspberrypi.com/documentation/computers/getting-started.html#installing-the-operating-system)

MIT licensed. Independent educational project; not affiliated with Raspberry Pi
or the Yocto Project.
