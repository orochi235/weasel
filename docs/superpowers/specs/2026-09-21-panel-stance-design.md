# Panel stance and tone

**Status: designed 2026-09-21, not built.** Delete this file when the work merges.

For whoever implements it. It answers how a `PropertyPanel` says what kind of
content it holds, and which of its peers it is, while each theme decides what
that looks like.

## Why

astv's right sidebar draws three settings boxes — mode, view, layout — as solid
rounded boxes, one hue each, with its own CSS and hard-coded dark hex values that
are wrong in light mode. The kit has one panel look, so every app that wants a
second one hand-rolls it. The fix is a vocabulary for what a panel *is*; the look
belongs to the theme.

## API

```tsx
<PropertyPanel stance="scope" tone={1} title="View">…</PropertyPanel>
```

- `stance?: 'scope' | 'aside' | 'advanced' | 'debug' | 'danger' | 'notice' | 'important' | 'preview'`.
  Omitted, the panel draws exactly as today. A stance names a class of content,
  never a position:

  | stance      | holds                                                    |
  |-------------|----------------------------------------------------------|
  | `scope`     | settings that apply to one mode or view                  |
  | `aside`     | supplementary content that could be skipped              |
  | `advanced`  | expert settings most readers leave alone                 |
  | `debug`     | diagnostics for the app's builder, not its users         |
  | `danger`    | destructive or irreversible settings                     |
  | `notice`    | status the reader should see                             |
  | `important` | content the reader must not miss                         |
  | `preview`   | a picture of the content — a thumbnail, a minimap, a specimen |

- `tone?: number | string`: an index into the theme's tone list, wrapping, or a
  color given directly. Independent of `stance`, and allowed without one.
- The panel renders `data-stance`, `data-tone`, and `data-nested` (set when it
  sits inside another panel), and sets `--wzl-panel-tone` inline to the resolved
  color. Attributes, not module classes, so a theme or consumer can target them.
- A stanced panel's title takes the row-label recipe (small, uppercase) rather
  than the display title; the recipe itself is theme tokens.
- labkit's `<ControlPanel>` takes the same `title`, `stance` and `tone`, and wraps
  its rows in a `PropertyPanel` when any is given. astv's `KnobPanel` becomes
  `<ControlPanel title="View" stance="scope" tone={1} …/>`.

## Theme tokens

The base panel's hard-coded values become slots: `--wzl-panel-surface`,
`-border`, `-radius`, `-pad`, `-blur`, `-title-font`, `-title-size`,
`-title-case`, `-title-color`. With no stance a panel reads these, and nothing
changes visually.

Each stance may override any slot as `--wzl-panel-<stance>-<slot>`, falling back
to the base slot, so a theme declares only what differs. A nested panel reads
`--wzl-panel-<stance>-nested-<slot>` first, then the stance's slot.

A toned panel mixes its tone into the stance's surface:
`color-mix(in oklch, var(--wzl-panel-tone) var(--wzl-panel-<stance>-tone-mix), <surface>)`.
A mix rather than a replacement, so one tone list serves both modes.

The tokens live in the theme definition's `components` layer, so a child theme
restyles a stance by pinning a few names.

weasel's starting looks:

| stance      | look                                                                 |
|-------------|----------------------------------------------------------------------|
| `scope`     | solid box: raised surface with the tone mixed in, 8px radius, no border |
| `aside`     | no fill, hairline border, muted heading                              |
| `advanced`  | as no stance, muted heading                                          |
| `debug`     | dashed border, heading in the mono face                              |
| `danger`    | `--wzl-danger` mixed into the surface, heading in danger color       |
| `notice`    | accent mixed in lightly                                              |
| `important` | accent border and heading                                            |
| `preview`   | no padding, content to the edges, heading as a caption               |

## `ColorList`

A type in `@weasel-js/theme`, shared by theme, ui and labkit:

```ts
type ColorList =
  | readonly string[]                                     // literals
  | { readonly generate: { count: number; gates?: CategoricalRampDef['gates'] } } // the swatch ramp's generator
  | { readonly ramp: string }                             // a ramp of the active theme
  | ((i: number) => string);
```

- `colorAt(list, i, theme)` returns the i-th color, wrapping. A `ramp` list
  resolves against the active theme and so follows the mode; a `generate` list is
  computed once per parameter set and cached.
- A theme definition gains `tones: ColorList`. weasel's is `{ ramp: 'swatch' }`.
  A function cannot be written in a definition file, so definitions accept the
  other three forms.
- `<ThemeProvider tones={…}>` overrides the list for a subtree.
- labkit's `nebula` prop takes a `ColorList` in place of `string[]`.

## Testing

- Unit: `colorAt` for every form — wrap, per-mode ramp, generator cache;
  `PropertyPanel`'s attributes and `--wzl-panel-tone`; `ControlPanel` wrapping only
  when asked; the theme's panel tokens derive with no issues in both modes.
- Stylesheet: every stance slot is written with the base slot as its fallback. jsdom
  resolves no `var()`, so this is a proxy; the browser is the proof.
- Browser: a forge story, `PropertyPanel` › Stances — every stance and none, nested
  and not, tones 0–3 — in both modes and every density, added to `tests/visual`.
- Consumer: astv's three boxes rebuilt on this in a local astv branch and compared
  against today's screenshot. Nothing lands in astv without its owner's go.

## Out of scope

Other surfaces (`Subpanel`, `EffectCard`, `Callout`, sidebar sections, toasts,
dialogs) — the P1 in `docs/TODO.md` carries the convention to them.
