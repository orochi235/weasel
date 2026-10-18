// `globalThis.gc()`, so a spec can collect the garbage it built between
// measurements instead of paying for it inside a timed block. Absent the
// flag `gc` is undefined and specs fall back to timing through it.
// `--use-angle=metal` because headless otherwise picks ANGLE's OpenGL
// backend, measuring a path shipping Chrome on macOS does not take.
// Local network access checks refuse vite's HMR socket on a page
// `lib/isolate.ts` made cross-origin isolated, and log it as an error.
export const perfLaunchArgs = ['--js-flags=--expose-gc', '--use-angle=metal', '--disable-features=LocalNetworkAccessChecks'];
