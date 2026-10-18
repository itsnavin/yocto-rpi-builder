const systems = {
  make: {
    name: "Plain Make",
    configure: false,
    detail: "The bundled Makefile builds in-source: B equals S. There is no configure script and do_configure is marked noexec, so no run.do_configure script is expected. run.do_compile calls oe_runmake with the recipe's EXTRA_OEMAKE (CC, flags and install paths). run.do_install calls oe_runmake with DESTDIR set to D. For another Makefile, inspect its rules: do not assume -C, an out-of-tree build or standard variable names are supported.",
  },
  autotools: {
    name: "Autoconf / Automake (Autotools)",
    configure: true,
    detail: "Sources contain configure.ac, Makefile.am and main.c. inherit autotools supplies native Autoconf/Automake tools, autoreconf and configure with the cross --build/--host settings, site files and installation paths. B is normally WORKDIR/build, separate from S. Replay run.do_configure before run.do_compile: it regenerates/configures the Makefiles; compilation uses oe_runmake. Do not run a bare ./configure in S, omit --host, or replace the class tasks. run.do_install uses make install with DESTDIR=D.",
  },
  cmake: {
    name: "CMake",
    configure: true,
    detail: "Sources contain CMakeLists.txt and main.c. inherit cmake generates the target toolchain file and supplies cmake-native plus the selected backend (Ninja by default here). B is normally WORKDIR/build, separate from S. Replay run.do_configure before run.do_compile to use the actual source path, toolchain/sysroot, generator and install flags. The class builds from B and installs with DESTDIR=D. Do not guess cmake .. from the devshell source directory, pick host gcc, or supply a hand-written replacement toolchain.",
  },
};

export function devshellLesson(template, name = "hello-pi") {
  if (!Object.hasOwn(systems, template)) throw new Error("Unsupported devshell build system");
  if (typeof name !== "string" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name) || name.length > 60)
    throw new Error("Unsafe recipe name");
  const system = systems[template];
  return {
    title: `${system.name}: debug compilation with devshell`,
    detail: system.detail,
    prepare: `# ORIGINAL Linux Bash terminal, not inside devshell.
# Adapt this path/build directory if yours differs.
cd "$HOME/yocto-rpi"
source poky/oe-init-build-env build
# Your layer/recipe must already be added and its source/license reviewed.
bitbake-layers show-recipes ${name}
# Prepare sysroot/toolchain prerequisites and generate current task scripts.
${system.configure ? `bitbake ${name} -c configure -f\n` : "# Plain Make: do_configure is noexec; no configure replay needed.\n"}bitbake ${name} -c compile -f
bitbake ${name} -c install -f
# Stop at a failure; read the printed log path before proceeding.
# Record these EXPANDED BitBake values, particularly T, S, B and D:
bitbake -e ${name} | grep -E '^(S|B|D|T|WORKDIR|CC|CXX|CFLAGS|CPPFLAGS|LDFLAGS|RECIPE_SYSROOT|RECIPE_SYSROOT_NATIVE)='
bitbake ${name} -c devshell
`,
    replay: `# NEW devshell terminal. It normally starts in S, NOT necessarily B.
pwd
printf 'exported CC: %s\\n' "$CC"
# S/B/D/T are BitBake metadata, not guaranteed exported shell variables.
# Paste the absolute T value printed earlier, without its surrounding quotes.
read -r -p "Absolute T path from bitbake -e: " taskdir
# Inspect generated scripts first. The unnumbered names point to latest scripts.
${system.configure ? 'ls -l "$taskdir/run.do_configure" "$taskdir/run.do_compile" "$taskdir/run.do_install"\nsed -n \'1,100p\' "$taskdir/run.do_configure"\n' : 'ls -l "$taskdir/run.do_compile" "$taskdir/run.do_install"\n'}sed -n '1,100p' "$taskdir/run.do_compile"
sed -n '1,100p' "$taskdir/run.do_install"
# Execute, do NOT source, the generated scripts. Stop if a script fails.
${system.configure ? '"$taskdir/run.do_configure" && "$taskdir/run.do_compile"' : '"$taskdir/run.do_compile"'}
# Do not run run.do_install here: use BitBake's fakeroot-aware install below.
exit
`,
    finish: `# Back in the ORIGINAL initialized build terminal; close devshell first.
# Persist source/build-file changes in the layer's files/project/ or a patch.
# For Git, commit upstream and update SRCREV (and license checksum if changed).
# Files edited only in tmp/work are temporary and can be replaced.
# Invalidate the first relevant task and let BitBake run downstream tasks.
bitbake ${name} -C ${system.configure ? "configure" : "compile"}
# BitBake reruns compile/install/package as needed, with install under fakeroot.
# Use ONE image target with this package already in IMAGE_INSTALL:
bitbake core-image-minimal
# Or, if using the downloaded custom image recipe:
# bitbake my-rpi-image
# Inspect the image manifest, then flash the new image deliberately.
`,
  };
}

export function devshellDocument(template, name) {
  const lesson = devshellLesson(template, name);
  return `${lesson.title}
Pinned release: Yocto 5.0.13 / Scarthgap.
These instructions are documentation-checked, not an executed BitBake devshell test.

${lesson.detail}

1. Prepare outside devshell
${lesson.prepare}

2. Inspect and replay inside devshell
${lesson.replay}

3. Persist changes, then return to BitBake
${lesson.finish}

Important:
- devshell needs a working interactive terminal. OE_TERMINAL selects a supported
  terminal; install/configure one on the Linux host (for example tmux in an
  interactive session) rather than setting OE_TERMINAL=none. Headless CI needs
  noninteractive BitBake task commands, not a popup devshell.
- devshell prepares patch/sysroot prerequisites but does not itself guarantee
  configure/compile/install have executed. The preparation commands above do.
- If a task failed, its run script is normally available for debugging. Do not
  continue to compile after a failed configure. Missing scripts can result from
  sstate/stamps: exit and force the specific task outside devshell, then reopen.
  Make's noexec configure task is intentionally different: no script is needed.
- Execute current scripts from the recorded T directory; do not guess a tmp/work
  path or use stale PID-suffixed scripts from another recipe/revision.
- The scripts capture BitBake's exact environment, flags and working directories.
  oe_runmake is a task-script helper, not a guaranteed interactive shell command.
  Do not invoke host gcc or try running ARM target executables on the build host.
- D is the packaging staging root, not /usr on your host and not your Pi.
  Never sudo make install. Inspect run.do_install, but run installation through
  BitBake outside devshell so pseudo/fakeroot and package ownership are correct.
- Replaying scripts does not update BitBake task stamps or package an image.
  Manual debug edits/builds are not persistent recipe changes. Save changes first,
  then invalidate the appropriate task with -C and rebuild the recipe and image.
- Missing cmake/autoreconf/compiler tools: check the inherited class, DEPENDS and
  prepare_recipe_sysroot/task logs. Let BitBake provide its native tools/sysroots;
  installing arbitrary host tools is not a replacement for recipe dependencies.

Official release guidance:
https://docs.yoctoproject.org/5.0.13/dev-manual/development-shell.html
Pinned devshell implementation:
https://github.com/yoctoproject/poky/blob/529843b1c189ab7b133b7fdf197d4b2a4b71a6db/meta/classes-global/devshell.bbclass
`;
}
