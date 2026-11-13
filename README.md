# weasel

A 2D scene-graph engine for React, rendered on WebGL2. Bring your own node data and pose shape; weasel owns the scene tree, the viewport math, pointer and keyboard input, layered rendering, and op-based undo/redo — plus a standard set of editing actions (select, move, resize, rotate, delete, duplicate, nudge, group, align, clipboard, …) bound to the keys and gestures an editor user expects.

Built for diagram editors, sketch tools, schematic editors, scene composers — anything where "objects on a canvas the user can grab, move, and arrange" is the substrate.

## Getting started

[`packages/core/README.md`](./packages/core/README.md) is the guide: installing, mounting `<SceneCanvas>`, the feature presets, actions and how to tune or replace them, text, custom shaders, and core's subpath imports. It is also the README on npm and the site's "Get started" page.

## Demo

<https://orochi235.github.io/weasel/> — every kit feature as a small runnable demo, plus the release history for every published version.

## Packages

Every package is published under `@weasel-js` and released together at one version. `npm run check:needs` holds the marks to the code.

<!-- packages:start -->

<img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"> needs React · <img src="docs/badges/react-optional.svg" width="20" height="20" alt="React only under the /react subpath" title="React only under the /react subpath"> React only under `/react` · <img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser" title="Needs a browser"> needs a browser; the rest run in Node or a worker · <img src="docs/badges/webgl2.svg" width="20" height="20" alt="Draws with WebGL2" title="Draws with WebGL2"> WebGL2 · <img src="docs/badges/webaudio.svg" width="20" height="20" alt="Plays through Web Audio" title="Plays through Web Audio"> Web Audio · <img src="docs/badges/standalone.svg" width="20" height="20" alt="Depends on no other weasel package" title="Depends on no other weasel package"> no other weasel package

| Package | | What it is |
|---|---|---|
| `core` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"><img src="docs/badges/webgl2.svg" width="20" height="20" alt="Draws with WebGL2" title="Draws with WebGL2"> | the scene graph, `<SceneCanvas>`, actions, and tools |
| `headless` |  | `renderSceneToPixels` from Node: a headless Chromium page holding one raster session, scenes in as JSON and pixels out |
| `geom` | <img src="docs/badges/standalone.svg" width="20" height="20" alt="Depends on no other weasel package" title="Depends on no other weasel package"> | pure geometry — 2D affine, box, curve, polyline; polygon booleans under `./booleans`; 3D vectors, quaternions, matrices and rays under `./3d` |
| `gestures` | <img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | the gesture taxonomy, route grammars and matchers |
| `history` |  | undo/redo with scoped sub-histories |
| `routing` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | binding-to-action routing: the gesture dispatcher, the action registry, tool and contribution declaration |
| `select` |  | selection as a value: which ids a press selects, with toggle, range and anchor rules |
| `ui-input` |  | what a key or a pointer does to a control, as pure functions: steps, sliders, list roving and typeahead, selection, reorder |
| `ui-logic` |  | what a DOM component and a canvas-drawn widget share past their drawing: the measure/draw contract and a focus scope |
| `menu` |  | the headless model behind context menus: entries, a controller for highlight, submenus, keyboard and typeahead, and placement |
| `registry` | <img src="docs/badges/standalone.svg" width="20" height="20" alt="Depends on no other weasel package" title="Depends on no other weasel package"> | keyed registries you can enumerate and subscribe to |
| `icons` |  | namespaced icon names and the icon registry; no React, no DOM, no glyphs of its own |
| `icons-plugin` |  | the build plugin that ships only the glyphs a build names, for vite, rollup, rolldown and esbuild |
| `react` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | generic React hooks the other packages share: `useLatest`, `useStableByContent`, `useVisibleRaf` |
| `paint` | <img src="docs/badges/standalone.svg" width="20" height="20" alt="Depends on no other weasel package" title="Depends on no other weasel package"> | fills, strokes, gradients and dashes as plain data |
| `stroke` |  | a stroke as geometry: the ribbon mesh, the marker registry, and a stroke outlined as a path |
| `renderer` | <img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"><img src="docs/badges/webgl2.svg" width="20" height="20" alt="Draws with WebGL2" title="Draws with WebGL2"> | the WebGL2 renderer: draw commands, batched fills and strokes, text, images, gradients, patterns, shader programs, and effects |
| `pdf` | <img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | PDF documents from draw commands, with selectable embedded text, and regions of a scene written as one |
| `dither` | <img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"><img src="docs/badges/webgl2.svg" width="20" height="20" alt="Draws with WebGL2" title="Draws with WebGL2"> | pixels to 1-bit ink: four ditherers for an export, and threshold and Bayer as a live effect on a printer's dot grid |
| `p-touch` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | Brother P-touch labels from a scene: `.lbx` files, and printing over WebUSB or Web Serial |
| `plot` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | scales, axes, and marks, and charts built from them that edit by dragging their values |
| `text` | <img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | styled runs, kerned layout, wrapping and measurement |
| `text-dom` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | in-place text editing: a contenteditable overlay that reads and writes styled runs |
| `bidi` | <img src="docs/badges/standalone.svg" width="20" height="20" alt="Depends on no other weasel package" title="Depends on no other weasel package"> | the Unicode Bidirectional Algorithm (UAX #9) |
| `text-shaping` |  | OpenType shaping through HarfBuzz: joined Arabic, Indic conjuncts and reordering, mark placement, ligatures and a face's own small caps |
| `font` | <img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | MSDF atlases, glyph metrics and runtime glyph rasterization |
| `quantity` | <img src="docs/badges/standalone.svg" width="20" height="20" alt="Depends on no other weasel package" title="Depends on no other weasel package"> | numbers with units and a display, as text, spoken text, HTML and MathML |
| `simulation` | <img src="docs/badges/react-optional.svg" width="20" height="20" alt="React only under the /react subpath" title="React only under the /react subpath"> | an N-body integrator that takes d3-force's forces, and a hook that runs it on a frame loop |
| `svg` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | SVG import and export |
| `modes` |  | app-level modality: capability tags, mode definitions, a mode registry |
| `storage` | <img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | keyed async storage behind one adapter interface: IndexedDB, localStorage, the URL hash, memory |
| `prefs` | <img src="docs/badges/react-optional.svg" width="20" height="20" alt="React only under the /react subpath" title="React only under the /react subpath"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | a preferences schema, a store that validates, migrates and persists against it, and React hooks over the store |
| `diagram` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | node-link diagrams: ports on any node's perimeter, flowchart-style bodies |
| `diagram-elk` |  | an ELK layout adapter: lays a diagram out once with elkjs, ports, labels and nested groups included |
| `diagram-formats` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | diagrams to files: one page as an SVG document or a PNG image |
| `guides` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | placement aids: grids, guide lines, alignment and snapping to them, container layout strategies |
| `editor` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | an editor app's session, file and page glue: autosave and restore, snapshots, open and save, pages and their fit, the paper and grid |
| `hud` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"><img src="docs/badges/webgl2.svg" width="20" height="20" alt="Draws with WebGL2" title="Draws with WebGL2"> | WebGL-rendered widgets composited into a canvas |
| `animator` | <img src="docs/badges/react-optional.svg" width="20" height="20" alt="React only under the /react subpath" title="React only under the /react subpath"> | tweens, springs, holds, staggers and timelines that combine on targets, on one frame loop; no scene |
| `parallax` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | parallax planes and tiled surfaces: layers that draw other layers through a derived view |
| `minimap` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | a minimap with linked cursors: an overview you press and drag to move the main camera, on the canvas's own surface or one of its own |
| `kernel3d` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | poses, an orbit camera, ray picking and screen-projected chrome over core's scene graph; hosts a renderer |
| `symmetry` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | live symmetry groups: a container whose mirrored, rotated and repeated copies are drawn from its real children, so every edit reaches every copy |
| `path-tools` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | path-editing tools as presets an app opts into: brushes, bridge, trim and extend, curvature and handle balance, path constraints, path effects, and warps |
| `rig` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | rigging tools: the bone tool, which draws and edits a node's skeleton, and the weight tool, which paints how much each joint moves the paths under it |
| `cursor` |  | tool cursors as authored glyphs, baked to CSS or painted when too large |
| `loupe` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | a magnifier model: where it's aimed, how far it magnifies, what's under it |
| `brush` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | brushes for tools: one size shared across the tools that link to it |
| `audio` | <img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"><img src="docs/badges/webaudio.svg" width="20" height="20" alt="Plays through Web Audio" title="Plays through Web Audio"><img src="docs/badges/standalone.svg" width="20" height="20" alt="Depends on no other weasel package" title="Depends on no other weasel package"> | a Web Audio engine: voices, buses, lookahead scheduling, spatialization |
| `clock` | <img src="docs/badges/react-optional.svg" width="20" height="20" alt="React only under the /react subpath" title="React only under the /react subpath"> | a run of time: a position moved by a signed rate, with passes, ramps, seeking and one frame loop for many clocks |
| `d3` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | d3 data-join and transitions over `useScene` |
| `theme` | <img src="docs/badges/react-optional.svg" width="20" height="20" alt="React only under the /react subpath" title="React only under the /react subpath"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | design tokens as CSS variables and a parallel TypeScript export |
| `ui` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | React chrome components for weasel apps |
| `devtools` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | a panel that reads and steers every canvas on a page: its scene tree, state, dispatch trace and frame cost |
| `labkit` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"><img src="docs/badges/webgl2.svg" width="20" height="20" alt="Draws with WebGL2" title="Draws with WebGL2"> | React widgets for self-contained interactive lab pages |
| `forge` | <img src="docs/badges/react.svg" width="20" height="20" alt="Needs React" title="Needs React"><img src="docs/badges/dom.svg" width="20" height="20" alt="Needs a browser: document, window or navigator" title="Needs a browser: document, window or navigator"> | a component workshop on labkit: stories in isolated frames, controls and state in lab trials |

<!-- packages:end -->

## Documentation

- [Concepts](./docs/concepts.md)
- [Hooks](./docs/hooks.md)
- [Adapters](./docs/adapters.md)
- [Extending](./docs/extending.md)
- [Scene serialization](./docs/scene-serialization.md)

## License

MIT.
