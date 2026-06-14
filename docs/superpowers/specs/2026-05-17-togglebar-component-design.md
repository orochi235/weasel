# ToggleBar component — design

## Goal

Add a `ToggleBar` to `@weasel-js/ui` that visually matches `RangePicker`'s frosted-glass aesthetic (same track recipe, same selected-cell recipe as the RangePicker thumb) and is flexible enough to function as:

1. **Single-select segmented control** (primary use case)
2. **Multi-select toggle group**
3. **Boolean toggle** (a 2-segment single-select — no special API)

## Location

`packages/ui/src/components/ToggleBar/`:

- `ToggleBar.tsx`
- `ToggleBar.module.css`
- `ToggleBar.stories.tsx`
- `ToggleBar.test.tsx`
- `index.ts`

Export from `packages/ui/src/index.ts` alongside `RangePicker`.

## API

```ts
export type ToggleBarItem<V extends string | number = string> = {
  value: V;
  label?: ReactNode;        // text node or icon
  ariaLabel?: string;       // required when label is icon-only
  disabled?: boolean;
};

type CommonProps = {
  ariaLabel?: string;
  className?: string;
  /** Override height; default 24px to match RangePicker track. */
  height?: number;
};

export type ToggleBarProps<V extends string | number = string> =
  | (CommonProps & {
      mode?: 'single';
      items: readonly ToggleBarItem<V>[];
      value: V | null;
      onChange: (next: V | null) => void;
      /** When true, clicking the selected segment deselects it (yielding null). Default: false. */
      allowDeselect?: boolean;
    })
  | (CommonProps & {
      mode: 'multiple';
      items: readonly ToggleBarItem<V>[];
      value: readonly V[];
      onChange: (next: V[]) => void;
    });

export function ToggleBar<V extends string | number = string>(props: ToggleBarProps<V>): ReactElement;
```

Controlled only (matches `RangePicker`). No uncontrolled variant.

## Aesthetic — matches RangePicker

All values pulled from `RangePicker.module.css` so the components read as a family.

**Track** (`.root`)
- Height: `var(--wzl-tb-height, 24px)`
- Background: `var(--wzl-track-bg)`
- Border: `1px solid var(--wzl-track-border)`
- Border-radius: `3px`
- `overflow: hidden` (no thumb spill here — selected cells stay inside the track)
- `display: flex`
- `user-select: none; -webkit-user-select: none; touch-action: none`

**Segment** (`.segment`)
- `flex: 1 1 0; min-width: 0`
- Transparent background by default
- `display: flex; align-items: center; justify-content: center`
- `font: 500 0.7rem/1 ui-sans-serif, system-ui, sans-serif`
- `color: var(--wzl-text-muted)` when unselected
- `cursor: pointer`
- Separated by 1px dividers in `var(--wzl-track-border)` (left border on every segment except the first) so the segmentation reads even when nothing is selected.

**Selected segment** (`.segment[aria-checked="true"]`, `.segment[aria-pressed="true"]`)
- Background: `color-mix(in srgb, var(--wzl-thumb-fill) 70%, transparent)`
- `backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px)`
- Inset 1px border via `box-shadow: inset 0 0 0 1px var(--wzl-thumb-border), 0 1px 2px rgba(0, 0, 0, 0.2)` (inset for the border so it doesn't fight the divider geometry; outer drop for raise)
- Color: `var(--wzl-thumb-text)`
- `text-shadow: 0 0 2px rgba(255, 255, 255, 0.7)`
- Transition: `background 120ms, box-shadow 120ms, color 120ms`

**Focus** (`.segment:focus-visible`)
- `outline: 2px solid var(--wzl-accent); outline-offset: -2px` (negative so it stays inside the rounded track)

**Disabled** (`.segment:disabled`)
- `opacity: 0.5; cursor: not-allowed`

## Interaction

**Click / pointerdown → click**
- `mode='single'`:
  - If clicked segment is already selected and `allowDeselect`, call `onChange(null)`.
  - Otherwise call `onChange(value)`.
- `mode='multiple'`:
  - Toggle the clicked value in/out of the array. New array, no in-place mutation.

**Keyboard — single mode**
- `role="radiogroup"` on root; each segment is a `<button type="button" role="radio" aria-checked={...}>`.
- `ArrowLeft` / `ArrowUp`: move selection (and focus) to previous non-disabled segment; wraps.
- `ArrowRight` / `ArrowDown`: move selection (and focus) to next non-disabled segment; wraps.
- `Home`: first non-disabled segment.
- `End`: last non-disabled segment.
- `Tab` focuses the currently-selected segment (roving tabindex: selected = `tabIndex=0`, others = `tabIndex=-1`). If `value` is `null`, the first non-disabled segment is the tab stop.

**Keyboard — multiple mode**
- `role="group"` on root; each segment is a `<button type="button" aria-pressed={...}>`.
- `ArrowLeft/Right/Up/Down`, `Home`, `End`: move focus only; selection unchanged.
- `Space` / `Enter`: toggle the focused segment.
- Roving tabindex anchored to the focused segment (first non-disabled segment initially).

**Disabled segments**
- Not focusable, not togglable, skipped by arrow navigation.

**aria-label**
- Root gets `aria-label={ariaLabel}` when provided.
- Each segment uses `item.ariaLabel ?? <text content of label>`. If `label` is an icon and no `ariaLabel` provided, the component should still render but accessibility will be degraded — document this in the prop comment.

## Component structure

```tsx
<div className={s.root} role={mode === 'multiple' ? 'group' : 'radiogroup'} aria-label={ariaLabel}>
  {items.map((item, i) => (
    <button
      key={item.value}
      type="button"
      role={mode === 'multiple' ? undefined : 'radio'}
      aria-checked={mode === 'multiple' ? undefined : isSelected}
      aria-pressed={mode === 'multiple' ? isSelected : undefined}
      aria-label={item.ariaLabel}
      disabled={item.disabled}
      tabIndex={isTabStop ? 0 : -1}
      className={s.segment}
      onClick={...}
      onKeyDown={...}
    >
      {item.label}
    </button>
  ))}
</div>
```

Internal helpers (module-scoped, not exported): `nextEnabledIndex`, `prevEnabledIndex`, `firstEnabledIndex`, `lastEnabledIndex`.

## Testing (`ToggleBar.test.tsx`)

Vitest + Testing Library, mirroring `RangePicker.test.tsx`'s style:

- **Single mode**
  - Renders N segments, marks `value` segment `aria-checked="true"`.
  - Click an unselected segment → `onChange` called with that value.
  - Click selected segment with `allowDeselect=false` (default) → no `onChange`.
  - Click selected segment with `allowDeselect=true` → `onChange(null)`.
  - Arrow keys move selection and focus; wraps at ends; skips disabled.
  - `Home`/`End` jump to ends.
- **Multiple mode**
  - Click toggles value in/out of array.
  - `Space`/`Enter` toggle focused segment.
  - Arrow keys move focus only, don't mutate selection.
- **Disabled**
  - Disabled segment not clickable, skipped by arrow nav.
- **Accessibility**
  - Single mode uses `role="radiogroup"` with `radio` children.
  - Multiple mode uses `role="group"` with `aria-pressed` buttons.
  - Roving tabindex: exactly one segment has `tabIndex=0`.

## Storybook (`ToggleBar.stories.tsx`)

- `Single` — 4 text segments (e.g. `Left / Center / Right / Justify`).
- `Multiple` — 3 toggleable segments (e.g. `B / I / U` bold/italic/underline, icon labels).
- `Boolean` — 2-segment single-select (`On / Off`).
- `Disabled` — one segment disabled inside an otherwise active bar.
- `Tall` — `height={32}` to show the `--wzl-tb-height` knob.
- `AllowDeselect` — single mode with `allowDeselect`.

## Out of scope (YAGNI)

- No sliding-thumb animation (rejected during brainstorm — breaks for multi-select).
- No drag-to-extend selection.
- No overflow handling (scroll, popover); items are expected to fit the container.
- No uncontrolled state.
- No vertical orientation.
- No theming knobs beyond what `RangePicker` already exposes (`--wzl-track-*`, `--wzl-thumb-*`, `--wzl-accent`, `--wzl-text-muted`, `--wzl-tb-height`).
