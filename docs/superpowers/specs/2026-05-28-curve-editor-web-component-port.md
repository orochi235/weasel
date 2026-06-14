# CurveEditor → standalone web component (parked plan)

**Status:** Parked. Pick up when (a) CurveEditor's React API has been stable for a week, and (b) a concrete consumer needs the standalone widget.

## Why

CurveEditor is intended for "drop into arbitrary labs and one-off projects with whatever UI framework or none at all." Today it ships as a React component in `@weasel-js/ui` — which means consumers either reach for React or pay R2WC's ~50KB React runtime tax per page.

A native web component (`<curve-editor>`) lets consumers `<script src=…>` + drop the custom element anywhere — vanilla HTML, Vue, Svelte, static-site labs, internal admin tools. Bundle target: 10–20 KB minified+gzipped.

## What ports cleanly as-is

These modules are framework-agnostic and reusable without change:

- `catmullRom.ts` — Catmull-Rom sampling (centripetal/uniform/chordal)
- `monotone.ts` — Fritsch-Carlson monotone cubic
- `interpolation.ts` — InterpolationMode dispatcher + linear sampler
- `geometry.ts` — model↔plot transforms, hit tests
- `setCurveOp.ts` — weasel-history Op factory (optional; consumer of the web component probably doesn't use weasel-history, so this may not ship in the standalone bundle)

What needs rewriting is **just the React component itself** (`CurveEditor.tsx`, ~600 lines): the rendering layer + drag/click/delete interaction logic + state management.

## Approach options

### Option A — Port to Lit, keep React version alive in parallel

Two implementations. Every CurveEditor feature lands twice. Sustainable only if API churn slows to ~monthly.

- **Lit version**: `@weasel-js/curve-editor` (new package). Registers `<curve-editor>`. Ships Lit (~5 KB) + component (~5-10 KB). Pure standalone widget.
- **React version**: stays in `weasel-ui`. Used by apps/draw and React-based consumers.

Sync discipline: changes to the shared math modules are free; changes to the rendering/interaction logic land in both files within the same PR.

### Option B — Lit-only, retire the React version

Apps/draw consumes `<curve-editor>` as a custom element (React 19 supports custom elements natively via `customElements.define` and JSX with kebab-case tags). The React-specific wrappers (refs, children patterns) don't translate cleanly, but CurveEditor's API surface is small enough that it shouldn't matter.

- Smallest maintenance burden after the port.
- One-time cost: update apps/draw's CurveEditor usage to the custom-element form.
- Loses React-specific ergonomics (no `useCurveEditorState` hooks etc., but we don't have those today anyway).

### Option C — Extract pure core, wrap twice

Refactor CurveEditor into:

- `core.ts` — framework-agnostic class `CurveEditorCore` that takes an `SVGElement`, owns the rendering + drag state + value list, exposes events (`change`, `commit`)
- React wrapper — thin component that mounts `CurveEditorCore` in a useEffect, forwards props/events
- Lit wrapper — thin custom element that mounts `CurveEditorCore` in `connectedCallback`, forwards attributes/events

Highest upfront cost (~2-3 days of careful refactor). Lowest ongoing cost: features land in `core.ts` once and both wrappers benefit.

**Worth it if** CurveEditor's API keeps growing or if a third surface emerges (e.g., a Solid wrapper, or a Stencil wrapper for a different design-system consumer).

**Not worth it if** Option B (Lit-only) is acceptable for apps/draw too.

## Pre-port checklist

Don't start until:

- [ ] CurveEditor React API has been unchanged for at least a week (currently iterating daily; would be premature).
- [ ] A concrete external consumer (lab, demo, embed) is queued up to use the standalone version. Builds momentum and validates the API in the new shell.
- [ ] Decision on which subapproach (A / B / C) — make it explicitly, document it here.

## Post-decision file map (Lit-only / Option B as the default starting point)

```
packages/curve-editor/                # new package
├── package.json                              # esm-only, "exports" entry, sideEffects: false
├── src/
│   ├── index.ts                              # exports the custom element + registers on import
│   ├── CurveEditorElement.ts                 # the LitElement class
│   ├── CurveEditorElement.module.css         # scoped styles (Shadow DOM)
│   ├── catmullRom.ts                         # copied from weasel-ui (or imported if we expose it)
│   ├── monotone.ts                           # same
│   ├── interpolation.ts                      # same
│   ├── geometry.ts                           # same
│   └── CurveEditorElement.test.ts            # Web Test Runner or Vitest with happy-dom
├── tsconfig.json
└── README.md                                 # consumer-facing usage docs
```

### Math module sharing

Decision needed: copy the math modules into the new package (simple, slight duplication), or extract them into a shared `@weasel-js/curve-math` package (clean, more packages to publish, version-coordination overhead).

Recommendation: copy on day 1. If a third consumer emerges, extract then.

## API translation from React to Lit

| React prop | Lit equivalent |
|---|---|
| `value: ControlPoint[]` | `@property({ type: Array }) value` |
| `onChange: (next) => void` | `dispatchEvent(new CustomEvent('change', { detail: next }))` |
| `onChangeCommit: (next, prev) => void` | `dispatchEvent(new CustomEvent('commit', { detail: { next, prev } }))` |
| `domain: '1d' \| '2d'` | `@property() domain` (string attribute) |
| `interpolation: …` | `@property() interpolation` |
| `endpoints: …` | `@property() endpoints` |
| `addPointMode: …` | `@property() addPointMode` |
| `grid: false \| null \| GridSettings` | `@property({ type: Object }) grid` |
| `axes: false \| null \| AxesSettings` | `@property({ type: Object }) axes` |
| `fill: false \| null \| FillSettings` | `@property({ type: Object }) fill` |
| `hideNonInteractive: boolean` | `@property({ type: Boolean }) hideNonInteractive` |
| `constrain: 'none' \| 'function'` | `@property() constrain` |
| `width: number` | `@property({ type: Number }) width` (or attribute on the host) |
| `height: number` | same |
| `xRange: [number, number]` | `@property({ type: Array }) xRange` |
| `yRange: [number, number]` | same |

Consumer usage:

```html
<script type="module" src="https://unpkg.com/@weasel-js/curve-editor"></script>

<curve-editor
  domain="1d"
  endpoints="pinned-both"
  width="400"
  height="200"
></curve-editor>

<script>
  const editor = document.querySelector('curve-editor');
  editor.value = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];
  editor.addEventListener('change', (e) => console.log('preview', e.detail));
  editor.addEventListener('commit', (e) => console.log('committed', e.detail));
</script>
```

## Theming

The Lit version uses Shadow DOM, which by default isolates the component from the host page's CSS. Three approaches to theming:

1. **Inherit `--wzl-*` tokens via the cascade.** CSS custom properties DO pierce Shadow DOM. The custom element can consume `var(--wzl-fg)` etc., and the host page just needs to load `@weasel-js/theme/tokens.css`. Works.
2. **Bake a default theme into the component.** Ship `tokens.css` inline as a `<style>` inside the Shadow Root. Works standalone with zero host-page setup. Override-able via the `--curve-*` vars at the custom element's host.
3. **Expose a `theme` attribute.** `<curve-editor theme="light">` switches between built-in palettes. More opinionated, less flexible.

Recommendation: **#2 by default, with the `--wzl-*` tokens used internally**. Consumers who load `weasel-theme/tokens.css` get the kit's full design system; those who don't get a sensible default. Best of both worlds.

## Distribution

- npm: `@weasel-js/curve-editor`
- CDN: `unpkg.com/@weasel-js/curve-editor` (auto via npm publish)
- IIFE bundle for `<script src>` (no module needed): build a separate `dist/curve-editor.iife.js` via Vite's library mode
- Targets: ES2020 (covers all modern browsers; no IE11 effort)

## Bundle size budget

- Lit: ~5 KB gz
- CurveEditor + math modules: target ~8-12 KB gz
- Total: under 20 KB gz. If we cross that, audit before shipping.

## What this plan does NOT cover

- The actual Lit code. Write it when porting starts.
- Tests. Decide on test runner at port time (Vitest with happy-dom is the lowest-friction option).
- Storybook integration for the Lit version. The kit's existing Storybook is React-focused; the Lit version may want its own Storybook or just a static HTML demo page.
- Versioning between the React and Lit versions. If Option A, they likely version together; if Option B, only the Lit version exists.
- Reverse: porting other weasel-ui components to web components. Out of scope.

## Decision log

- 2026-05-28: Plan written. Parked pending API stabilization. Owner: Mike.
