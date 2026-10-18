# Pi Foundry / yocto-rpi-builder

A beginner-friendly, browser-only Yocto recipe workbench and an end-to-end guide
to preparing a custom **64-bit Raspberry Pi 4 or Pi 5** Linux image.

**Live application:** <https://itsnavin.github.io/yocto-rpi-builder/>.
Published through GitHub Pages with desktop/mobile live smoke checks.

## What it does

- Generates standalone **C**, **C++**, and **data-file** package recipes from local
  examples or a public HTTPS Git repository with a pinned commit.
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

The Node test suite covers all 12 board/template/source combinations, license
handling, input/URI/path/metadata injection edge cases, compiler/install flags,
image/config consistency, branch pins, deterministic tar checksums/round-trips,
long archive paths, and core accessibility/static asset contracts. The browser
suite exercises templates, validation, Git licensing, board-specific config,
downloads, keyboard tabs, quiz behavior, text-only rendering and responsive
overflow. These are application tests, **not BitBake or physical Raspberry Pi tests**.

For a manual browser check: switch both boards; try all three templates and both
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

**Test status:** 78 Node unit tests and 14 desktop/mobile Chromium browser tests
passed locally on Node 22.23.3 and in GitHub Actions on Linux; the static production
build and Pages deployment succeeded. Live desktop/mobile smoke checks verified
asset loading, board-specific config/guide, tar downloads, layout and browser errors.
The source/release/machine definitions are documentation-checked only:
no successful full Yocto build or physical Pi boot is claimed. Application tests
do not establish board support. A pinned release is reproducible input
metadata, not a guarantee that all upstream downloads remain available or that
old snapshots contain current security fixes. Review updates before deployment.

For this release, local `file://` sources unpack into `${WORKDIR}`, and Git into
`${WORKDIR}/git`. Generated recipes use an explicit separate `${B}` and install
under `${D}`. Do not carry these unpacking conventions into newer Yocto releases
without consulting their migration notes.

## License and source boundaries

Local sample code is MIT-licensed under this repository's LICENSE. Its recipe
references the actual Poky common MIT license and the checksum used by
[Poky's pinned hello-single example](https://github.com/yoctoproject/poky/blob/529843b1c189ab7b133b7fdf197d4b2a4b71a6db/meta-skeleton/recipes-skeleton/hello-single/hello_1.0.bb).
For Git source, users must supply the actual license path and MD5 from the pinned
checkout. The site does not fabricate or remotely verify checksums. `CLOSED` is
only for authorized proprietary source; it is not a license-compliance shortcut.

The C/C++ templates compile **one standalone source file**, not arbitrary build
systems. Adapt for headers, multiple files, CMake/Make/Meson, libraries, linker
flags, runtime dependencies, services and complex licensing. DEPENDS alone does
not link libraries. The data template installs one file as
`/usr/share/<package>/message.txt`.

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
