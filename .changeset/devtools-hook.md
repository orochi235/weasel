---
"@weasel-js/core": patch
"@weasel-js/routing": patch
---

Add a devtools hook. Each mounted `<SceneCanvas>` registers a root on `window.__weaselDevtools__`,
which serves a panel over a versioned message protocol: the scene tree a level at a time, a node's
pose and data, selection, view, tools, probes, the dispatch trace and frame stats, plus select,
highlight, set-tool and debug-overlay commands. A dev build installs the hook itself; a production
build installs it only when the app imports the new `@weasel-js/core/devtools` subpath, which also
exports the protocol types and the in-page and `postMessage` transports. See `docs/devtools.md`.

The debug overlay gains a `highlight` feature (`debug={{ highlight: ids }}`), and `<Canvas>` and
`<SceneCanvas>` take an `aria-label`.

Breaking: the dispatch trace is per canvas now. `window.__weaselDispatchLog__`,
`window.__weaselDispatchLive__` and `window.__weaselCoordLog__` are gone, and so are routing's
`recordModeSwitch` and `publishLiveDispatch`. A dispatcher records into `DispatcherContext.trace`
(`createDispatchTrace`), which `useGestureDispatcher` creates or takes as its `trace` option and
publishes as the `dispatchTrace` dep; record a mode switch with
`deps.get('dispatchTrace')?.recordModeSwitch(…)`.
