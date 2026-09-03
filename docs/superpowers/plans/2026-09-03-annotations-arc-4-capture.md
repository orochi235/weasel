# Annotations arc 4 — capture

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** export a target's picture with its marks on it — as a PNG or as an SVG — from a button in the trial toolbar, and from an API a host can call itself.

**Architecture:** labkit cannot rasterize the artifact underneath, so a target hands over its base. With an SVG base the marks serialize to vector and nest into the artifact's own markup: one document, rasterized once at the end, and an SVG output for free. With a raster base both sides rasterize and stack, marks rendered offscreen at export scale by `renderSceneToPixels` — never read back off the live surface, so a capture neither depends on nor disturbs what is on screen.

**Scope boundary.** Arc 4 closes with capture. brick-icons is arc 5.

**Tech stack:** React 19, TypeScript, `@weasel-js/core` (`renderSceneToPixels`), `@weasel-js/svg` (`serializeSvg`), `@weasel-js/ui` (`Callout`), vitest (`--project=labkit`), Playwright (`tests/visual`).

**Spec:** `docs/superpowers/specs/2026-09-02-labkit-annotations-design.md`, arc 4.

---

## Deviations from the spec

- **The target's field is `base`, not `capture`.** The spec names both the target's hand-over and the API that returns a Blob `capture`, which makes every sentence about either one ambiguous. A target hands over *its base* — the spec's own words — and `AnnotationsApi.capture()` returns the finished thing.
- **`base` sits on `AnnotationTargetInfo`, not `AnnotationTarget`.** The split is React-shaped versus not: `ref` and `view` are what only the overlay reads, and `AnnotationTargetInfo` is what the store sees. `base` is a plain function the store has to call, so it belongs on the narrow half.
- **`@weasel-js/svg` is an ordinary dependency, inlined** — the spec's one Open question. It is not a real fork: labkit's tsup declares `noExternal: [/^@weasel-js\//]`, and `@weasel-js/ui` already depends on `svg`, so svg is *already* inlined into labkit's dist today. Adding it to `dependencies` is a manifest declaration and nothing else, and it matches the settled `labkit keeps an ordinary dependency` row in `docs/proposals/2026-08-31-singleton-packages-as-peers.md`.
- **`onCapture` notifies; it does not intercept.** The spec leaves "where it goes is the host's" open. A hook that can suppress labkit's own download needs a return protocol and a rule nobody can see from the call site. A host wanting its own flow calls `annotations.capture()` from its own UI, which is the same surface the chrome uses.
- **SVG copies as text.** `ClipboardItem` takes `image/png` unprefixed; `image/svg+xml` needs Chromium's `web ` prefix and no other app reads it. Copying the markup as `text/plain` is what a person actually wants from a vector export.

---

## File structure

**Created — `packages/labkit/src/annotations/`**
- `capture.ts` + `capture.test.ts` — the plan, the SVG composition, the raster stack, the blob
- `svgNodes.ts` + `svgNodes.test.ts` — a mark as `SvgNode[]`, off the same geometry `markCommands` uses
- `drawOne.ts` — the shared per-mark draw callback (extracted from the overlay)
- `ExportMenu.tsx` + `ExportMenu.test.tsx` — the toolbar popover

**Modified**
- `paint.ts` — geometry computed once, emitted as commands or as SVG nodes
- `types.ts` — `CaptureSource`, `CaptureOptions`, `CaptureResult`, `base`, `onCapture`, `targets()`, `capture()`
- `store.ts` — `meaning` / `config` in the options; `targets()`; `capture()`
- `AnnotationOverlay.tsx` — use the extracted `drawOne`
- `index.ts` + `../index.ts` + `../index.test.ts` — exports
- `chrome/builtins.tsx` — the Export contribution
- `trial/Trial.tsx` — pass `meaning` and the config getter into the store
- `packages/labkit/package.json` — `@weasel-js/svg`
- `packages/labkit/examples/annotate-lab/PartInspector.tsx` — both panes hand over their SVG

**Created — site + browser**
- `apps/site/demos/AnnotationCaptureDemo.tsx` + registry entry
- `tests/visual/annotations-capture.spec.ts`

---

### Task 1: a target hands over its base

- [ ] **Failing test first** (`capture.test.ts`): `api.targets()` reports the declared targets in declaration order, including one that declares no `base`. A target's `base()` is not called until a capture asks for it.
- [ ] `CaptureSource` in `types.ts` — the three-way union from the spec (`svg` / `image` / `canvas`). `base?: () => CaptureSource | Promise<CaptureSource>` on `AnnotationTargetInfo`, with the reason for the narrow half in its doc.
- [ ] `AnnotationsApi.targets(): readonly AnnotationTargetInfo[]` — the export menu needs the list, and reading it off the capability would need instrument state the chrome does not carry.
- [ ] `AnnotationStoreOptions` gains `meaning?` and `config?: () => unknown`. Both are what capture needs to resolve a mark's colour and its staleness, and `config` is a getter for the same reason `targets` is. Wire both from `Trial.tsx`.
- [ ] Tests pass; commit.

### Task 2: one draw path for the screen and for the export

- [ ] **Failing test first** (`capture.test.ts`): the drawOne the export uses and the drawOne the overlay uses are the same function, and it resolves a status colour and a stale dash from the target and config it was built with. Assert the *commands*, not that two call sites reference one symbol.
- [ ] Extract `createMarkDrawOne({ content, positionDependsOn, config, meaning })` into `drawOne.ts`; `AnnotationOverlay` calls it instead of closing over its own copy. An export that draws marks differently from the screen is the defect this prevents.
- [ ] Tests pass; commit.

### Task 3: a mark as vector

- [ ] **Failing test first** (`svgNodes.test.ts`): each of the six kinds yields `SvgNode[]` whose geometry matches what `markCommands` produces for the same mark — same path data, same stroke width, cap, join and dash. An arrow yields its head as its own node, since `markCommands` already resolves marker geometry rather than leaving `markerEnd` inert.
- [ ] Refactor `paint.ts` so a mark's geometry is computed **once** — a shared `markShapes()` returning resolved paths + stroke + fill — and `markCommands` / `markSvgNodes` are two emitters over it. Two independent geometry switches is the divergence this avoids, and the test above is what catches it.
- [ ] `text` maps to `SvgTextNode`; everything else to `SvgPathNode`.
- [ ] Tests pass; commit.

### Task 4: compose

- [ ] **Failing test first** (`capture.test.ts`) — the plan is a pure function, so test it as one. `capturePlan(base, format)` returns `'svg-document'` for any `format: 'svg'` and for `format: 'png'` over an SVG base, and `'raster-stack'` for `png` over an image, a canvas, or no base at all. Say in the test that the rasterizing halves are browser-tested, because jsdom's canvas cannot fail them.
- [ ] **SVG composition** (`composeCaptureSvg`), tested in vitest — jsdom has `DOMParser`. The outer document is `viewBox="0 0 W H"` with `width`/`height` at `W×scale`, where `W`/`H` are the target's **content box**, so export resolution is independent of the pane's on-screen size. The base nests as a child `<svg>` with `x`/`y`/`width`/`height` forced to the content box and **its own `viewBox` kept** — parse it rather than string-splicing, or a base whose declared width disagrees with its viewBox lands at the wrong scale. Marks nest as the document `serializeSvg` returns, `viewBox="0 0 W H"` and no width/height, which makes a nested `<svg>` fill the outer viewport exactly.
- [ ] Pass `onWarn` to `serializeSvg`. Without it a paint with no vector form is dropped while the element keeps its `fill="url(#id)"`, and the shape silently vanishes in a viewer.
- [ ] An `image` / `canvas` base under `format: 'svg'` embeds as `<image>` — a canvas via `toDataURL()`, an image via its `src`. Warn when that `src` is not a `data:` URI: the export is then not self-contained.
- [ ] **Raster stack**, browser-only: base drawn into a 2D canvas at `W×scale`, then marks from `renderSceneToPixels({ scene, sourceRect: {0,0,W,H}, scale: {x: s, y: s}, drawOne })` — straight RGBA, so it goes through `ImageData` onto a second canvas and composites over with `drawImage`. `putImageData` replaces pixels instead of compositing, which would erase the base.
- [ ] **Rasterizing the composed SVG**: Blob → object URL → `Image` → `drawImage` → `toBlob('image/png')`, revoking the URL. A base referencing an external image taints the canvas and `toBlob` throws `SecurityError`; catch it and reject with a message naming the cause rather than the DOM exception.
- [ ] `store.capture(targetId, opts)` → `Promise<CaptureResult>` (`{ blob, format, width, height, target }`), firing `onCapture` after. Unknown target id rejects.
- [ ] Tests pass; commit.

### Task 5: the chrome, and a lab that uses it

- [ ] **Failing test first** (`ExportMenu.test.tsx`): an instrument declaring `annotations` gets an Export button in the toolbar; opening it lists every target, PNG and SVG, and the three scales; Download calls `capture` with what was picked. An instrument declaring none gets no button.
- [ ] `ExportMenu.tsx` — `Callout` + `CalloutTrigger` from `@weasel-js/ui`, added to `passthrough/weasel-ui.ts` alongside `Select`. Reads the store through `useAnnotationsOptional()`, the way `MarkList` does; the chrome context carries no instrument state and is not the route.
- [ ] Download is an object URL on an `<a download>`, revoked after. Copy writes `ClipboardItem` `image/png`, or the markup as `text/plain` for SVG.
- [ ] Contribute it from `chrome/builtins.tsx` under `instrument.annotations != null`, in the `trial` group beside the snapshot picker. It takes the `render` escape because a popover is not an icon button.
- [ ] `PartInspector` (the annotate-lab example) declares `base` on both panes off its own SVG, and an `onCapture` that says what came back. Two panes with different pictures is what proves the target picker.
- [ ] Tests pass; commit.

### Task 6: prove it in a browser

- [ ] `apps/site/demos/AnnotationCaptureDemo.tsx` — one lab, one target, an SVG base with a **known feature at a known place**, and a host-side panel that calls `annotations.capture()` and shows the result in an `<img data-testid="capture-result">`. The panel is the demo's point: a host driving the API, not just labkit's chrome driving it.
- [ ] Register it; keep it terse and single-purpose per the demo rules in `CLAUDE.md`.
- [ ] `tests/visual/annotations-capture.spec.ts`, **no committed baseline** — GL and SVG rasterization are not byte-identical across drivers. Draw a mark over the known feature, capture at `scale: 4`, read the result back with `createImageBitmap` → 2D canvas → `getImageData`, and probe: the mark's colour is present where the feature is, the base's colour is present where it should be, and the output is `content × 4` pixels.
- [ ] A second case: `format: 'svg'` returns a document containing both the base's marker element and a `<path>` with the mark's stroke colour.
- [ ] **A viewport calibration, which the repo does not have.** Drag a mark at a known client point on a pane and assert the store's `frac` is where the arithmetic says — on a pane that is *not* at the surface origin, which is the case that breaks. `tests/visual/insert.spec.ts` and `shape-tools.spec.ts` both defer exactly this in their own headers, and the overlay's client→world path was only ever checked by hand in the arc-2 spike.
- [ ] A third: the toolbar Export → Download fires a real download (`page.waitForEvent('download')`) whose suggested filename names the target.
- [ ] Tests pass; commit.

### Task 7: gate and close out

- [ ] `npx tsc --noEmit && npm run lint && npm test`, foreground, output read. `cd packages/labkit && npm run lint` too — the root script is eslint and does not run biome.
- [ ] `npm run check:manifests` and `npm run test:smoke:consumer` — the second is the only check that catches an undeclared dependency, and this arc adds one.
- [ ] Playwright: `npx playwright test --config tests/visual/playwright.config.ts annotations-capture`.
- [ ] A `patch` changeset. Say in the prose that labkit gains a dependency and that annotation capture is new API.
- [ ] Close arc 4 in the spec — what was built, and the five deviations above with their reasons, in the shape arcs 1–3 use. Retire the "Open" section's svg question.
- [ ] `docs/TODO.md` if anything here retires or rewrites an entry.
- [ ] Delete this plan.
