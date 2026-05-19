# Theme refactor + Button component

Two coupled pieces of work in one branch. The theme refactor lands first so
the Button can consume real semantic tokens; the Button is the first new
component built fully against the new system and serves as the
reference shape for future weasel-ui components.

## Motivation

`weasel-theme` today is a flat 17-variable dump in a single `:root` block.
The variables it defines are inconsistent with what components actually
reference — `--wzl-bg`, `--wzl-fg`, `--wzl-muted`, `--wzl-surface`,
`--wzl-border`, `--wzl-warning`, `--wzl-swatch-size` are all consumed but
never defined, so they silently fall back to nothing. There is no
semantic layer (surface-base / surface-raised, fg / fg-muted), so consumers
have invented their own scales (swillustrator's `--ckd-*` palette) and
bridged them in by hand.

The frosted-glass aesthetic seen in `ToggleBar.segmentSelected` and
`RangePicker.thumb` is the kit's visual identity, but it is not exposed
through a token — it's hard-coded in each component as
`color-mix(in srgb, var(--wzl-accent) 78%, transparent) + backdrop-filter`.
That makes the look brittle to skin.

Beyond the theme gaps, weasel-ui has no `Button` primitive. `ToolButton` is
a specialized icon-+-label-stacked toolbar button. Apps that want a plain
"Save" / "Cancel" / "Delete" button hand-roll one. This is the most
basic primitive in any UI kit and should ship now, before more
specialized components accumulate ad-hoc button styles.

## Out of scope

- Migrating swillustrator off `--ckd-*` (kept; the override layer remains
  the way apps re-skin the kit).
- A light theme. Default is dark; a light companion may follow later.
- Split buttons, button groups, toggle buttons (use `ToggleBar`), menu
  buttons. These are separate components.
- Loading-spinner primitive. The Button's `loading` state uses a simple
  inline CSS spinner local to the component — extracting a shared
  `Spinner` is a follow-up.

## Part 1 — Theme refactor

### Token structure

Two layers, both defined in `packages/weasel-theme/src/tokens.css`:

**Primitive scale** — raw values, not intended for direct component
consumption. Documented as such with a comment block.

```
/* Neutrals — perceptually-spaced gray ramp */
--wzl-gray-50:  #f5f5f6;
--wzl-gray-100: #e6e7e9;
--wzl-gray-200: #c9cbcf;
--wzl-gray-300: #9ea1a8;
--wzl-gray-400: #6f737b;
--wzl-gray-500: #4d5058;
--wzl-gray-600: #383b42;
--wzl-gray-700: #25272c;
--wzl-gray-800: #181a1e;
--wzl-gray-900: #0e0f12;

/* Accent — neutral violet, chosen so it reads as "interactive" without
   carrying brand connotation. Swap freely at the app level. */
--wzl-accent-soft:   #6e5ec4;
--wzl-accent-base:   #8472e0;
--wzl-accent-strong: #a193f0;

--wzl-danger-base:  #d94a3f;
--wzl-warning-base: #d99a3f;

/* Geometry */
--wzl-radius-sm: 3px;
--wzl-radius-md: 5px;
--wzl-border-w:  1px;
```

**Semantic tokens** — what components actually reference. Each is a thin
wrapper over a primitive so the app-level theme can re-map them without
touching component CSS.

```
/* Surfaces — three depths */
--wzl-surface:        var(--wzl-gray-800);   /* default panel/app bg */
--wzl-surface-raised: var(--wzl-gray-700);   /* tooltips, menus */
--wzl-surface-sunken: var(--wzl-gray-900);   /* inputs, tracks */

/* Text */
--wzl-fg:           var(--wzl-gray-100);
--wzl-fg-muted:     var(--wzl-gray-300);
--wzl-fg-subtle:    var(--wzl-gray-400);
--wzl-fg-on-accent: var(--wzl-gray-50);

/* Borders */
--wzl-border:        var(--wzl-gray-700);
--wzl-border-strong: var(--wzl-gray-600);

/* Interactive */
--wzl-accent:       var(--wzl-accent-base);
--wzl-accent-hover: var(--wzl-accent-strong);
--wzl-danger:       var(--wzl-danger-base);
--wzl-warning:      var(--wzl-warning-base);
--wzl-focus-ring:   var(--wzl-accent-strong);

/* Frosted glass — the kit's signature treatment.
 * Consumers compose: color-mix(in srgb, var(--wzl-glass-tint) 78%, transparent)
 * + backdrop-filter: blur(3px). */
--wzl-glass-tint: var(--wzl-accent);
```

### Deprecated aliases

Every legacy token currently in use is preserved as a one-line alias at
the end of `tokens.css`, behind a `/* @deprecated */` comment block.

```
--wzl-text:               var(--wzl-fg);
--wzl-text-muted:         var(--wzl-fg-muted);
--wzl-panel-bg:           var(--wzl-surface);
--wzl-panel-border:       var(--wzl-border);
--wzl-input-bg:           var(--wzl-surface-sunken);
--wzl-track-bg:           var(--wzl-surface-sunken);
--wzl-track-border:       var(--wzl-border);
--wzl-thumb-fill:         var(--wzl-fg-muted);
--wzl-thumb-border:       var(--wzl-border-strong);
--wzl-thumb-text:         var(--wzl-gray-900);
--wzl-button-fill:        var(--wzl-surface-raised);
--wzl-button-fill-hover:  color-mix(in srgb, var(--wzl-fg) 10%, transparent);
--wzl-button-fill-pressed: color-mix(in srgb, var(--wzl-fg) 18%, transparent);
--wzl-button-text:        var(--wzl-fg);
```

Existing components are not edited as part of this refactor — they keep
consuming the legacy names. They will be migrated incrementally as they
are next touched. New components consume semantic tokens directly.

### Fix dangling references

The seven tokens components reference but no theme defines —
`--wzl-bg`, `--wzl-fg`, `--wzl-muted`, `--wzl-surface`, `--wzl-border`,
`--wzl-warning`, `--wzl-swatch-size` — are resolved:

- `--wzl-fg`, `--wzl-surface`, `--wzl-border`, `--wzl-warning` are now
  first-class semantic tokens.
- `--wzl-bg` aliased to `--wzl-surface`.
- `--wzl-muted` aliased to `--wzl-fg-muted`.
- `--wzl-swatch-size` is a Badge-specific token (verified by grep);
  moved into a `:root` block inside `Badge.module.css` with a default,
  out of the theme package entirely.

### Foundations story

New file: `packages/weasel-ui/src/components/Foundations/Foundations.stories.tsx`.

Renders, in order:

1. **Surfaces** — three labeled cards stacked, each painted with one
   surface token, showing the depth hierarchy.
2. **Text** — sample text rendered in each `--wzl-fg-*` token over each
   surface.
3. **Borders** — two divider rules at each border weight.
4. **Accents** — accent / accent-hover / danger / warning swatches with
   hex readout.
5. **Glass** — a translucent panel painted with the
   `color-mix + backdrop-filter` recipe, over a gradient so the blur is
   visible. Annotated with the recipe code.
6. **Primitives** — the full gray ramp + accent ramp as a strip of
   swatches with hex readouts (for reference; rarely consumed directly).

No interactivity. Pure visual reference. The story is the documentation.

## Part 2 — Button component

### File layout

```
packages/weasel-ui/src/components/Button/
  Button.tsx
  Button.module.css
  Button.test.tsx
  Button.stories.tsx
  index.ts
```

Exported from `packages/weasel-ui/src/index.ts` as `Button`, `ButtonProps`.

### Component shape

```ts
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';   // default: 'secondary'
  size?: 'sm' | 'md';                             // default: 'md'  (24px tall)
  disabled?: boolean;
  loading?: boolean;
  iconOnly?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';           // default: 'button'
  ariaLabel?: string;
  className?: string;
  onClick?(e: MouseEvent<HTMLButtonElement>): void;
  children?: ReactNode;
}
```

### Variant visuals

All variants share padding/typography per size; only fill / border / text
differ.

- **`primary`** — frosted accent fill, mirrors `ToggleBar.segmentSelected`:
  `background: color-mix(in srgb, var(--wzl-glass-tint) 78%, transparent)`,
  `backdrop-filter: blur(3px)`,
  `color: var(--wzl-fg-on-accent)`,
  `text-shadow: 0 1px 1px rgba(0,0,0,.35)`,
  `box-shadow: 0 1px 2px rgba(0,0,0,.25)`.
  Hover: bump tint to `--wzl-accent-hover`.
  Active: drop the box-shadow and shift fill slightly darker.

- **`secondary`** — translucent track look:
  `background: var(--wzl-surface-sunken)`,
  `border: 1px solid var(--wzl-border)`,
  `color: var(--wzl-fg)`.
  Hover: `background: color-mix(in srgb, var(--wzl-fg) 8%, var(--wzl-surface-sunken))`.

- **`ghost`** — transparent until hovered:
  `background: transparent`, `border: 1px solid transparent`,
  `color: var(--wzl-fg)`.
  Hover: `background: color-mix(in srgb, var(--wzl-fg) 8%, transparent)`.

All three share `:focus-visible { outline: 2px solid var(--wzl-focus-ring); outline-offset: 1px; }` and `:disabled { opacity: 0.5; cursor: not-allowed; }`.

### Sizes

- `sm` — 20px tall, 8px horizontal padding, 11px font, icon 12px
- `md` — 24px tall, 12px horizontal padding, 12px font, icon 14px

These align with `--wzl-tb-height` defaults so a Button can sit cleanly
next to a ToggleBar in a toolbar row.

### Loading state

When `loading` is true:
- `aria-busy="true"` is set on the button.
- The button stays interactive at the DOM level *unless* `disabled` is
  also set (caller's call — usually you want both).
- Visually: `leadingIcon` is replaced by a small CSS spinner (a single
  `<span>` with a rotating SVG arc, scoped to the module). `children`
  stays visible but its opacity drops to 0.7.

### Icon-only mode

When `iconOnly` is true:
- The button becomes square (`width: <height>`).
- Padding collapses to 0.
- `children` is rendered as the icon (caller passes the SVG as
  children rather than via `leadingIcon`).
- `ariaLabel` is required at the type level via a discriminated union
  (`iconOnly: true` narrows `ariaLabel: string`). No runtime check —
  TypeScript enforces it at the call site.

### Stories

1. **Primary**, **Secondary**, **Ghost** — one each, "Save" label.
2. **Sizes** — sm and md side by side.
3. **WithIcons** — leading icon, trailing icon, both.
4. **IconOnly** — square buttons, all three variants.
5. **Loading** — primary mid-load, "Saving…".
6. **Disabled** — all three variants disabled.
7. **FullWidth** — a 320px container with a single full-width primary.
8. **Matrix** — grid of {variant} × {sm,md} × {default, hover-simulated
   via class, disabled} for visual regression.

### Tests

`Button.test.tsx` covers:

- Renders children, fires `onClick`.
- `disabled` prevents `onClick`.
- `loading` sets `aria-busy="true"`.
- `type` defaults to `'button'` (regression — uncontrolled forms).
- Keyboard: Enter and Space activate.
- Variant + size class application (snapshot-ish — just assert the
  expected class strings are present on the root).

## Implementation order

1. Add the new token structure to `weasel-theme/tokens.css` alongside the
   legacy ones. Verify Storybook loads. Verify swillustrator still
   renders (it overrides anyway, so any regression is the override
   layer's, not ours).
2. Build the Foundations story. This validates the tokens visually
   before any component is built against them.
3. Build Button + Button.module.css against semantic tokens.
4. Add Button stories. Iterate visual polish in Storybook.
5. Add Button tests.
6. Export from `weasel-ui/src/index.ts`.
7. Run `npm run prepublishOnly`-equivalent (tsc + vitest + tsup).

## Acceptance

- `npm test -w @orochi235/weasel-ui` green.
- `npx tsc --noEmit` clean.
- Storybook shows: Foundations story, all eight Button stories, and
  every previously-existing story still renders without visual
  regression (legacy aliases preserve the look).
- swillustrator dev server starts and the app renders unchanged (it
  overrides every legacy token, so this is a check on the alias chain).
