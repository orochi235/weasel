/**
 * The subpaths that promise no React, and why each exists. Two checks hold
 * them to it: `check:react-free` walks each one's built module closure, and
 * `check:needs` typechecks its source with no React types and no `lib.dom` —
 * the program a package built on it gets measured by for the README table.
 * An entry promises no DOM either unless it says `dom: true`.
 */
export const REACT_FREE_ENTRIES = [
  {
    spec: '@weasel-js/icons',
    why: 'names and the registry, read by prefs and routing, which must not pull React in',
  },
  {
    spec: '@weasel-js/icons-plugin',
    why: 'the build plugin, loaded by a bundler config in Node',
  },
  {
    spec: '@weasel-js/core/math',
    why: 'the geometry and simulation half, for a server with no DOM',
  },
  {
    spec: '@weasel-js/core/json',
    why: "stableStringify, which forge's dev-server capture endpoint keys its cache with in Node",
  },
  {
    spec: '@weasel-js/font/metrics',
    why: 'atlas and face metrics and CSS family names, which diagram/layout measures with',
  },
  {
    spec: '@weasel-js/diagram/layout',
    why: 'measurement, ranking, force and ports, for a server-side layout',
  },
  {
    spec: '@weasel-js/simulation',
    why: 'the integrator; the frame-loop hook lives behind @weasel-js/simulation/react',
  },
  {
    spec: '@weasel-js/clock',
    why: 'the clock and its registry; the frame-loop hook lives behind @weasel-js/clock/react',
  },
  {
    spec: '@weasel-js/animator',
    why: 'targets, timelines and axes, which core/math reaches; the hook lives behind @weasel-js/animator/react',
  },
  {
    spec: '@weasel-js/renderer',
    why: "draw commands to pixels; a paint kind's editor is registered in core",
    dom: true,
  },
  {
    spec: '@weasel-js/prefs',
    why: 'the schema and the store; the hooks live behind @weasel-js/prefs/react',
    dom: true,
  },
];
