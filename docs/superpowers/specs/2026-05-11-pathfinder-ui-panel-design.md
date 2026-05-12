# Pathfinder UI panel — design

Status: design, awaiting user approval before implementation plan.

Promoted from the Tier 3 Pathfinder follow-ups in `docs/TODO.md`. The
`useBooleans` action hook is imperative-only today; consumers wanting a
button palette wire their own. This spec ships a generic `PathfinderPanel`
component in `@orochi235/weasel-ui` so any consumer can drop in the five
boolean ops without re-inventing the icons, the disabled-state predicate,
or the click handlers.

## Goal

Ship a presentational `PathfinderPanel` React component in
`@orochi235/weasel-ui` that renders the five `useBooleans` actions
(`union` / `intersect` / `subtract` / `exclude` / `divide`) as a row of
icon buttons, with built-in Illustrator/Figma-convention SVG icons,
uniform disabled-state derivation, and slots for icon and label override.

The kit's main `@orochi235/weasel` package is unchanged — this is
consumer-facing chrome only.

## Scope

**In:**

- `PathfinderPanel` styled component in `packages/weasel-ui/src/`.
- Five built-in inline SVG icons matching the Illustrator/Figma
  Pathfinder visual convention.
- `icons` prop for per-op icon override; `labels` prop for per-op label
  override; `orientation: 'horizontal' | 'vertical'`.
- Internal disabled-state derivation from the adapter's selection +
  `getWorldPath` (uniform `<2 paths` predicate across all five ops).
- Unit tests, Storybook stories, demo integration into the existing
  `BooleanOpsDemo`.
- Public exports from `@orochi235/weasel-ui`.

**Out:**

- Live preview during the gesture (separate TODO entry — explicitly
  skipped in the current Pathfinder follow-up sweep).
- Keyboard shortcut binding inside the panel — consumers wire shortcuts
  via `useKeybindings` against the same `actions` object.
- Tooltip framework / shortcut-display strings on the buttons — the
  default `title` attribute is sufficient for v1.
- A generic `<ActionBar>` component that subsumes Pathfinder and other
  action hooks (`useAlign`, `useDistribute`, `useFlip`, …). That
  abstraction belongs after the Tier 1 "Formalize the Tool schema"
  follow-up lands — see `docs/TODO.md`.
- Visual-regression Playwright spec for the panel itself — story
  snapshots are sufficient v1 chrome coverage, and `boolean-ops.spec.ts`
  already locks the result geometry.

## Component location & file layout

```
packages/weasel-ui/src/
  PathfinderPanel.tsx
  PathfinderPanel.module.css
  PathfinderPanel.test.tsx
  PathfinderPanel.stories.tsx
  pathfinderIcons.tsx         // five inline SVGs, not exported
```

Public exports added to `packages/weasel-ui/src/index.ts`:

```ts
export { PathfinderPanel } from './PathfinderPanel';
export type {
  PathfinderPanelProps,
  PathfinderIcons,
  PathfinderOp,
} from './PathfinderPanel';
```

The `pathfinderIcons.tsx` module stays internal — overrides flow through
the `icons` prop.

## API surface

```ts
import type { ReactNode } from 'react';
import type { BooleansAdapter, UseBooleansReturn } from '@orochi235/weasel';

export type PathfinderOp =
  | 'union' | 'intersect' | 'subtract' | 'exclude' | 'divide';

export type PathfinderIcons = Partial<Record<PathfinderOp, ReactNode>>;

export interface PathfinderPanelProps {
  /** Read selection + paths to derive disabled state. */
  adapter: Pick<BooleansAdapter, 'getSelection' | 'getWorldPath'>;
  /** Returned from `useBooleans(adapter)`. */
  actions: UseBooleansReturn;
  /** Override individual op icons. Falls back to built-in SVGs per op. */
  icons?: PathfinderIcons;
  /** Default 'horizontal'. */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Override per-op labels for a11y + tooltip. Defaults:
   * 'Union', 'Intersect', 'Subtract', 'Exclude', 'Divide'.
   */
  labels?: Partial<Record<PathfinderOp, string>>;
  className?: string;
}
```

### Hook coupling

The consumer calls `useBooleans(adapter)` and passes both `adapter`
(needed for disabled-state derivation) and the returned `actions`
(needed for click handlers). Two props, but one `useBooleans` instance
across the consumer's keybinding wiring and the panel:

```tsx
const adapter: BooleansAdapter = useMemo(() => ({...}), [...]);
const actions = useBooleans(adapter);
useKeybindings([
  { key: 'cmd+u',     action: actions.union },
  { key: 'cmd+alt+i', action: actions.intersect },
  // ...
]);
return <PathfinderPanel adapter={adapter} actions={actions} />;
```

Rationale: the dominant consumer pattern binds keyboard shortcuts to
Pathfinder ops, which requires the `actions` object in user code anyway.
Having the panel call `useBooleans` internally would create a duplicate
hook instance over the same adapter without saving the consumer a line.

### Disabled-state derivation

A uniform predicate runs every render:

```ts
const validCount = adapter
  .getSelection()
  .filter(id => adapter.getWorldPath(id) != null)
  .length;
const disabled = validCount < 2;
```

All five buttons share the same disabled flag. Rationale: every op in
`useBooleans` no-ops below 2 valid paths (subtract requires ≥2;
union/intersect/exclude/divide all silently no-op on fewer than 2
inputs per `applyBooleanOp` in `src/interactions/actions/booleans/booleans.ts`).
A per-op map would lie about availability.

Disabled buttons receive both `disabled` and `aria-disabled="true"`;
click is a no-op (event handler short-circuits before calling
`actions.<op>()`).

Re-derivation depends on the parent re-rendering when selection
changes. This is true for any React-managed selection in the codebase
(every selection sink runs through `useState` / `useSelection` /
`SelectionContext`).

## Visual design — default icons

Each icon: ~20×20 viewBox SVG, two overlapping circles (left + right),
rendered as outlined paths in `currentColor` stroke with the
op-specific result region filled in `currentColor`.

| Op | Filled region |
|---|---|
| `union` | Both circles fully (one merged blob). |
| `intersect` | Center lens (overlap) only; rest is outline. |
| `subtract` | Left circle minus the overlap (left-only crescent). |
| `exclude` | Both outer crescents (XOR); overlap stays unfilled. |
| `divide` | Both circles outlined plus a divider line through the overlap edges (three regions visible by outline). |

Style:

- Stroke `1.5px` `currentColor`, fill `currentColor` on highlighted
  regions.
- Color inherits from the button's `color` CSS property — themable
  without touching the component.
- 20×20 nominal SVG size; CSS sizes the parent button at 28×28 to
  match the LayerList row height convention.
- Buttons sit in a flex container (`row` or `column` per
  `orientation`).
- Panel chrome matches LayerList: `#1a1612` background, `#2a2418`
  border, 4px radius, 2px padding, 1px gap between buttons.
- States: `:hover` brightens fill; `:active` darkens; `[disabled]`
  drops opacity to ~0.4 and disables hover; `:focus-visible` uses the
  browser default focus ring.

## Testing

### Unit — `PathfinderPanel.test.tsx`

Vitest + React Testing Library. Each button has a stable test id
(`pathfinder-op-${op}`):

- Renders five buttons in op order (union, intersect, subtract,
  exclude, divide).
- ≥2 valid paths → all enabled; <2 → all disabled.
- Clicking each enabled button invokes the matching `actions.<op>`
  exactly once.
- Clicking a disabled button does not invoke the action.
- `icons` prop override renders the provided node in place of the
  default for that op; un-overridden ops keep defaults.
- `labels` prop override updates both `aria-label` and `title` for that
  op; un-overridden ops keep defaults.
- `orientation="vertical"` applies the vertical class (smoke check via
  class presence).
- Mixed selection: 3 ids where 1 returns `undefined` from
  `getWorldPath` → 2 valid paths → all buttons enabled. Asserts the
  filter predicate.

### Stories — `PathfinderPanel.stories.tsx`

CSF v3 stories. Each builds a minimal in-memory adapter against canned
paths:

- `Default` — horizontal, ≥2 paths selected, all enabled.
- `Disabled` — empty selection, all disabled.
- `Vertical` — `orientation="vertical"`, ≥2 paths selected.
- `CustomIcons` — three of five ops overridden with simple text/emoji
  nodes; two defaults; asserts the merge behavior visually.

Stories double as visual coverage; no Playwright spec for the panel
chrome itself.

## Demo integration

Extend the existing `demo/demos/BooleanOpsDemo.tsx`. Today it renders
five static canvas regions, each showing the result of one op on a
fixed input. Add a sixth, interactive region above the static grid:

- Single canvas with two overlapping draggable paths (a circle and a
  rect, matching the visual language of the static rows).
- `<PathfinderPanel>` rendered above the canvas, wired to a
  `useBooleans(adapter)` instance over the demo's scene.
- User selects ≥2 paths in the canvas → buttons enable → clicking
  commits the op destructively (matches v1 `useBooleans` semantics
  unchanged).
- A "Reset" button restores the initial two paths so the demo is
  replayable.

Keeps the demo a single `#boolean-ops` entry and gives the panel a live
home without a parallel demo card.

## Public exports

From `@orochi235/weasel-ui` (`packages/weasel-ui/src/index.ts`):

```ts
export { PathfinderPanel } from './PathfinderPanel';
export type {
  PathfinderPanelProps,
  PathfinderIcons,
  PathfinderOp,
} from './PathfinderPanel';
```

No changes to `@orochi235/weasel`'s main barrel. The panel is chrome;
the kit doesn't depend on it.

## Risk / open items

- **`BooleansAdapter` type imported across the package boundary.**
  `@orochi235/weasel-ui` already reaches into the kit for types
  (`NodeId`, etc.), so the import is not a new boundary, but the panel
  is now mildly load-bearing on `BooleansAdapter`'s shape. If the
  adapter ever drops `getWorldPath` (unlikely — it's core), the panel
  breaks. Low risk; flagged for awareness.
- **Re-derivation cost.** The disabled predicate runs every render and
  iterates the selection. O(selection length), trivial in practice
  (selections rarely exceed dozens of nodes; the kit's hot loops don't
  involve React renders).
- **Divider line in the `divide` icon.** The visual convention is
  weaker than the other four — Illustrator's Divide icon uses a
  fractured grid that doesn't render legibly at 20×20. The plan should
  prototype the icon and confirm legibility before committing to the
  outline-plus-divider design; fallback is a labeled button if the icon
  fails the squint test.
- **`labels` override for i18n.** The default labels are English. The
  `labels` prop covers single-language overrides but not full i18n
  pipelines. Defer a proper i18n seam — no consumer is asking for it
  and the panel has five strings.
