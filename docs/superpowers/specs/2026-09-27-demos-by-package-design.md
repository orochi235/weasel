# Demos by package

Scaffolding for the change that adds a **Packages** section to the demo site
(`apps/site`) and moves the single-package demos into it. Delete on merge.

## Rule

A demo filed under a package imports that package's symbols from
`@weasel-js/<package>` itself. `@weasel-js/core` is allowed only for the stage
(`SceneCanvas`, `useScene`, `WeaselProvider`, animator, draw-command types). A
demo that cannot meet this stays in its feature category and is listed in the
PR, not bent to fit.

## Registry

`DemoMeta` files each demo in exactly one place — a discriminated union:

```ts
type Placement = { category: string; package?: never } | { package: string; category?: never };
```

- `CATEGORIES` stays the feature categories, in file order.
- New `PACKAGES`: the package names that have at least one demo, in file order.
- The eyebrow shows `category ?? package`.
- Demo ids and `#id` URLs do not change.

The four package-named categories (`weasel-ui`, `weasel-diagram`, `weasel-hud`,
`labkit`) are removed; their demos take `package`. Core gets no package heading.

## Sidebar

After the feature categories, one **Packages** heading, then one subheading per
entry in `PACKAGES`, named without the scope (`text`, `audio`). No empty headings.

## Moves

| Demo id | From | To | Import change |
|---|---|---|---|
| `quantity` | weasel-ui | `quantity` | — |
| `audio` | Animation | `audio` | — |
| `d3-sortable` | Viewport | `d3` | — |
| `text-script` | Text | `text` | text symbols from `@weasel-js/text` |
| `text-nodes` | Text | `text` | same |
| `hud`, `loupe` | weasel-hud | `hud` | `HudDemo` drops `../../../packages/hud/src` for `@weasel-js/hud` |
| `diagram-*` (4) | weasel-diagram | `diagram` | verify |
| `annotation-capture`, `lab-loupe`, `auto-controls` | labkit | `labkit` | — |
| `perceptual-color-sliders`, `layered-curve`, `layer-list`, `selection-panel` | weasel-ui / Tools | `ui` | verify |

Stay put: `easings` (the easing functions live in core, not `geom`), `text-outlines` (renderer outline tier, not `font`), `boolean-ops`
(a tool demo, not a basic one).

## Tests

- `registry.test.ts`: every demo has exactly one of `category` / `package`;
  every demo renders under exactly one heading across `CATEGORIES` ∪ `PACKAGES`.
- New: every demo with `package: p` has an import from `@weasel-js/<p>` (or a
  subpath of it), read from its source text.
- `WeaselDemos.routing.test.tsx` still passes; headless screenshot of the sidebar.

## TODO entry (Demos & visual regression)

- Demos for packages with none: `gestures`, `history`, `routing`, `bidi`, `svg`,
  `paint`, `cursor`, `modes`, `kernel3d`, `loupe`, `geom`.
- A minimal public stage for package demos that need no scene graph. Not the
  primitive `<Canvas>`, which was unexported deliberately. Its use gets enforced
  by a test: only Packages-section demos for scene-free packages may import it.
