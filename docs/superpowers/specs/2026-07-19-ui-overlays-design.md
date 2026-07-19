# UI Overlays: Tooltip, Callout, Toast — Design

**Date:** 2026-07-19
**Status:** Approved
**Package:** `@weasel-js/ui` (`packages/ui`)

## Goal

Add three overlay primitives to weasel-ui, following the existing component
conventions (thin wrapper over `react-aria-components` where a stable primitive
exists, CSS module themed via tokens, stories + RTL tests, folder-per-component):

1. **Tooltip** — hover/focus hint with an arrow, replacing native `title=`
   usage across the kit.
2. **Callout** — an anchored, arrow'd callout pointing at a source element
   ("alert"-style guidance), modal or non-blocking via a prop.
3. **Toast** — transient notification queue + region, replacing the
   hand-rolled `Toasts.tsx` in `apps/draw`.

## Non-goals

- Inline alert banners and app-level status strips (not requested).
- A generic Popover primitive exported on its own (Callout is the consumer-
  facing surface; a bare Popover export can be split out later if needed).

## 1. Tooltip

**Location:** `packages/ui/src/components/Tooltip/`

Wraps stable RAC `TooltipTrigger` + `Tooltip` + `OverlayArrow`.

### API

```tsx
<TooltipTrigger delay={600} closeDelay={0}>
  <Button …/>
  <Tooltip placement="top">Duplicate layer</Tooltip>
</TooltipTrigger>
```

- `TooltipTrigger`: re-export with kit defaults — `delay` ≈ 600 ms,
  `closeDelay` 0. Accepts all RAC trigger props.
- `Tooltip` props: `placement` (`top` | `bottom` | `left` | `right`, default
  `top`), `offset` (default sized to clear the arrow), `children`.
- Arrow rendered via `OverlayArrow`, always pointing at the trigger; styled
  with theme tokens (same surface color as the tooltip body).
- RAC provides positioning, collision flipping, and `aria-describedby`
  wiring. Non-interactive content only (per ARIA tooltip semantics).

### Kit migration (same round)

- `ToolButton`: keep the `title` prop name and semantics (defaults to
  `label` + shortcut) but render a kit `Tooltip` instead of the native
  `title` attribute. Drop the native attribute to avoid double tooltips.
- `ToolPalette` inherits the change via `ToolButton`.
- Sweep remaining kit `title=` usages (e.g. `Dialog` close button) and
  convert or drop them deliberately; note each in the PR.

## 2. Callout

**Location:** `packages/ui/src/components/Callout/`

An anchored callout with an arrow pointing at its source element. Wraps
stable RAC `Popover` + `OverlayArrow` + `Dialog` (and `DialogTrigger` for
composed use).

### API

Two usage modes:

```tsx
// Trigger composition — opens on press of the wrapped trigger
<CalloutTrigger>
  <Button>What's this?</Button>
  <Callout tone="info" placement="bottom">…content…</Callout>
</CalloutTrigger>

// Programmatic — points at an arbitrary element, opened by app logic
<Callout
  triggerRef={someElementRef}
  isOpen={open}
  onOpenChange={setOpen}
  modal
  tone="warning"
>
  …content…
</Callout>
```

- `modal` (default `false`):
  - `false` — non-blocking: the app remains interactive; dismiss via Esc,
    outside click, or the close button. RAC non-modal popover behavior.
  - `true` — blocks interaction outside the callout until acknowledged;
    focus trapped; inner dialog gets `role="alertdialog"`.
- `tone`: `info` | `warning` | `danger` (default `info`). Maps to theme
  tokens for the accent border and arrow.
- `placement`, `offset`: as Tooltip.
- `title?`: optional heading (RAC `Heading slot="title"`), plus `children`
  body and an optional `footer` slot for action buttons — mirroring the
  existing `Dialog` prop shape.
- `showCloseButton` defaults to `true` when non-modal.
- The programmatic path (`triggerRef`) is first-class: in-canvas guidance
  usually isn't opened by clicking the target element.

### Scene-node anchoring (static, v1)

Callouts can point at an object inside a weasel scene — a canvas-drawn node
with no DOM element of its own.

- `Callout` gains a third anchor mode: `anchorRect?: { x, y, width, height }`
  in **client (viewport) coordinates**. Internally the component renders an
  invisible `position: fixed` element at that rect and uses it as the
  popover trigger ref, so RAC placement/flipping/arrow all work unchanged.
  `anchorRect` is plain data — `@weasel-js/ui` stays decoupled from core.
- `@weasel-js/core` exports one composition helper,
  `sceneNodeClientRect(opts): { x, y, width, height } | null`, where `opts`
  supplies the node `id`, the pose-resolution pieces already used by
  selection chrome (`composeSelectionPose` inputs — container ids collapse
  to the union AABB of their leaves), the current `View`, and the canvas
  element (for `getBoundingClientRect` offset). It composes existing
  primitives (`composeSelectionPose` → world AABB → `worldToScreen` →
  client offset); no new geometry code.
- **Static by design (accepted):** the rect is computed when the callout
  opens and does not track pan/zoom or scene mutations. Live tracking
  (re-anchoring on view change) is explicitly deferred to a future round.
- Tooltip does not get scene anchoring (tooltips are hover-driven on DOM
  elements; canvas-hover tooltips would route through hit-testing — out of
  scope). Toast is unanchored by definition.

## 3. Toast

**Location:** `packages/ui/src/components/Toast/`

Kit-owned public API; **internals wrap RAC's `UNSTABLE_Toast*` /
`UNSTABLE_ToastQueue`** (v1.18.0).

### Containment rule (hard)

RAC's toast API is alpha (`UNSTABLE_` prefix; Adobe has explicitly
deprioritized stabilizing it — still alpha 14 months after introduction).
The kit absorbs that instability:

- `UNSTABLE_` imports appear **only** inside the `Toast/` folder.
- No RAC toast type is re-exported or referenced in the public surface.
  Public types (`ToastOptions`, `ToastRegionProps`, queue interface) are
  kit-owned.
- If RAC's shape churns on upgrade — or stabilizes — the swap is internal
  to `Toast/` with zero consumer-visible change. A hand-rolled fallback
  remains a legal implementation behind the same API.

### API

```tsx
// Imperative, module-level default queue
toast('Saved');
toast.warning('SVG import', { description: '3 unsupported elements skipped' });

// Region — rendered once per app, near the root
<ToastRegion placement="bottom-right" />
```

- `toast(title, options?)` plus `toast.info/success/warning/error`
  variants. `ToastOptions`: `description?`, `ttlMs?` (default 8000; `null`
  = sticky until dismissed), `id?` for dedupe.
- `createToastQueue()` for isolation (tests, multiple roots); `ToastRegion`
  accepts a `queue` prop, defaulting to the module-level queue.
- Region behavior (from RAC): landmark region reachable via F6/keyboard,
  screen-reader announcements, hover pauses auto-dismiss timers. Close
  button always present.
- `placement`: `bottom-right` (default) | `bottom-left` | `top-right` |
  `top-left`.

### apps/draw migration (same round)

Delete `apps/draw/src/Toasts.tsx` + `Toasts.module.css` + test; replace
call sites (SVG parse warnings) with `toast.warning(...)` and mount
`<ToastRegion>` once. Port the existing `Toasts.test.tsx` coverage into the
kit component's tests.

## Shared conventions

Each component folder: `<Name>.tsx`, `<Name>.module.css`,
`<Name>.stories.tsx`, `<Name>.test.tsx`, `index.ts`; exported from
`packages/ui/src/index.ts`. No inline styles; all colors/spacing from theme
tokens. Arrow styling shared via a small common CSS pattern if it falls out
naturally (don't force a shared abstraction across Tooltip/Callout
prematurely).

## Testing

- **Tooltip:** shows on hover after delay / on focus immediately; hides on
  blur/Esc; `aria-describedby` wired; fake timers act-wrapped (act warnings
  reproduce only in CI — verify via CI logs, not just local vitest).
- **Callout:** trigger-composed open/close; programmatic `triggerRef` open;
  `modal` blocks outside interaction and traps focus, non-modal doesn't;
  Esc/outside-click dismiss in non-modal; `role="alertdialog"` when modal;
  tone class mapping; `anchorRect` mode positions the popover at the given
  client rect.
- **sceneNodeClientRect:** leaf node → composed world AABB → client rect
  (view + canvas offset applied); container id → union AABB of leaves;
  unknown id → `null`.
- **Toast:** queue add/dismiss; auto-dismiss at `ttlMs`, sticky with
  `null`; hover pause; multiple toasts stack; region landmark present;
  ported draw coverage.
- **Migration:** ToolButton renders kit Tooltip (no native `title`);
  draw builds and its toast call sites work.

## Risks

- **RAC toast churn:** contained per the rule above; worst case is
  reimplementing internals behind a frozen public API.
- **Double-tooltip regressions:** the `title=` sweep must remove native
  attributes wherever kit Tooltips are added.
- **Tooltip-in-Storybook interaction tests** are timing-sensitive; prefer
  RTL tests for behavior, stories for visuals.
