# Icons

How code names an icon, where the glyph for that name comes from, and how a build ships only the
glyphs it names. For anyone adding a glyph, drawing one, or wiring icons into an app. How to draw a
glyph well is under "Drawing rules" below.

## Names

An icon's name is qualified: `namespace:name`, as in `core:undo`, `ui:close`,
`path-tools:reversePath`. Code gets one from its own package's `icon()`, which returns an
`IconRef`, a branded string; a field that takes an icon takes an `IconRef`, so a bare string
literal fails the typecheck there.

```ts
// in ui, which depends on core
import { icon } from '../icons.gen';

icon('close');      // 'ui:close'
icon('core:undo');  // another namespace is always written qualified
```

A bare name means the calling package's own namespace and nothing else; there is no search. Every
qualified name is a key of the `IconName` interface in `@weasel-js/icons`, which each package's
generated `icons.gen.ts` extends, so a package can write another namespace's names only when it
depends on that package. Core cannot name a ui glyph, so every glyph core names is drawn in core,
including the stroke, paint and text-styling glyphs its properties use.

A string that arrives at run time, such as a prefs schema loaded from JSON, becomes a ref through
`toIconRef(value)`, which returns `undefined` for anything not qualified.

### Namespaces

The root that draws the glyphs declares its namespace and owner in `icons/index.mjs`. A namespace
belongs to one owner: two tables with the same namespace and the same owner merge (a package's
source table and its built one, say), and a table from a different owner is refused. Replacing one
glyph is explicit, through the registry's `override(ref, glyph)`.

| Namespace | Owner | Definitions | Holds |
|---|---|---|---|
| `core` | `@weasel-js/core` | `packages/core/icons/` | Tools, edit and history actions, align, booleans, path and anchor commands, text styling, stroke and paint |
| `ui` | `@weasel-js/ui` | `packages/ui/icons/` | Chrome, state, playback, arrows, key legends, marks, shapes and the rest of the component set |
| `path-tools` | `@weasel-js/path-tools` | `packages/path-tools/icons/` | The path tools and their commands |
| `rig` | `@weasel-js/rig` | `packages/rig/icons/` | The bone and weight tools |
| `shape` | `@weasel-js/icons` | `packages/icons/icons/` | Plain geometry: polygons, round shapes, stars |
| `diagram` | `@weasel-js/diagram` | `packages/diagram/icons/` | The container, org chart, network, BPMN, mind map, UML, and ERD stencils |
| `draw` | `apps/draw` | `apps/draw/icons/` | WeaselDraw's own actions |

`labkit`, `forge`, `site`, `theme-editor` and `forge-app` draw nothing. Their `icons/index.mjs`
declares a namespace and owner and no groups, so their `icon()` takes qualified names only.

## Adding a glyph

1. Draw it in an `icons/*.mjs` file of the package that owns it: an SVG body on a 20×20 viewBox,
   stroked in `currentColor`. The shared geometry helpers (`chevron`, `chevronOn`, `onCircle`) are
   in `packages/icons/scripts/lib/base.mjs`.
2. A new file's set goes into `groups` in that package's `icons/index.mjs`, as
   `[label, set, { tags }?]`. `tags` maps a glyph's key to search tags. Group order is gallery
   order; path order within a glyph is z-order.
3. Run `npm run gen:icons`. It writes each package's `src/icons.gen.ts` (its `icon()`, its
   `IconName` keys and `ICON_GROUPS`), `src/icons.table.json` and `src/icons.table.ts` (at the
   root itself when it has no `src/`). It fails on a
   namespace declared twice or a name drawn twice, differently, in one namespace.
4. Name it: `icon('newName')`.

A new package that draws glyphs also needs an `./icons` export pointing at its built table module
and a `"weaselIcons": { "table": "./dist/icons.table.json" }` field in `package.json`, with its
build copying the JSON into `dist`. Core, ui and path-tools show the shape. The build plugin finds
an installed package's glyphs through that field.

## Drawing rules

**Proof SVG icons at 10–15× their display size.** A glyph authored on a 20×20
viewBox gets inspected at ~240–320px before anyone looks at it small. At
chrome size a misplaced arrowhead or a join that doesn't meet is two blurry
pixels and reads as fine; blown up it is obviously broken. Render small only
afterward, as a legibility check — never as the design surface.

Compute terminus geometry, don't eyeball it. `M x y A rx ry rot laf sf dx dy`
ends at `(x+dx, y+dy)` — an arrowhead capping that arc puts its vertex
*there*. Same for a handle meeting a circle's rim: solve for the point on the
circle rather than guessing a coordinate that looks close.

**An arrowhead goes on a straight run, on a compass direction.** A head set on the end of a curve
and aimed along its tangent leans outward, and its inside barb closes up against the bending shaft;
below a radius of about twice the head's length it reads as a hook or a flag, and aiming it along
the chord instead only helps above radius 5. So end the curve early and carry the head on a
straight run at least as long as the barbs trail back.
Pick where the curve ends so that run points along an axis or a diagonal. On a diagonal run use
`chevron`'s spread of 45, which lays both barbs on the pixel axes; at 36–42 they sit a few degrees
off and blur at 16px. A head also needs a shaft showing behind its barbs, or it reads as a caret.
A ring or an open arc is free to turn: before reshaping anything, slide its gap round until the
head lands on the flattest stretch that is clear of other strokes.
Where there is no room for a straight run, hang the head on the shaft instead of on its tangent:
walk one trail of arc back from the tip and put the two barb ends on the curve's normal there, the
same distance either side. That holds down to a bend radius of about 1.2 head lengths; tighter,
the inner barb fills the bend, and the head wants to be solid. `chevronOn` in `packages/icons/scripts/lib/base.mjs`
draws this head, and `turn` in `packages/ui/icons/camera.mjs` uses it.

**Where one stroke passes behind another, cut it along the front stroke's outline grown by a fixed
gap.** The cut end is parallel to the stroke in front, not square to the stroke being cut: a butt
cap is only that where the two cross at a right angle *and* the stroke in front is straight there.
The gap is measured along the stroke being cut, and it is the same at every point across it: the
cut end is the front stroke's edge slid along by the gap, not an offset at right angles to it.
Behind a straight stroke, draw the back stroke on past the cut inside a nested `<svg>` whose
viewport ends at the cut line — it clips to its box and needs no id. Behind a curved one, make the
front stroke out of circular arcs, whose stroked edges are arcs again, fill the back stroke, and
end it on that edge arc slid by the gap: `turn` in `camera.mjs` builds its ring as a four-arc oval
for this, since an ellipse's edges are no curve path data can follow. Keep such coordinates to four
places. Never call a cut close enough by its size; he measures these zoomed in. One optical
exception: a short cut end facing a long curved edge reads flatter than the edge even when it
measures parallel, because the eye takes the edge's curvature from its whole run, so `turn`'s upper
axis end is bent 2.5 times as far as the ring beneath it, its middle kept at the gap. Round caps
stopped short of the crossing are worse again: the gap pinches, and the strokes read as unrelated.

**The small check is a separate check, and it is the pixel grid.** Proofing
large tells you nothing about chrome size. Rasterise at the size the chrome
actually renders — labkit's chrome regions draw glyphs at `size={16}` — magnify with
nearest-neighbour, and look at the pixels the renderer produced. A 16px glyph
inside a screenshot of a proof page has been resampled twice before you see it.

**Check 1× and 2× separately; they disagree.** At 1× a 16px icon gets 16 device
pixels and fine detail collapses; at 2× it gets 32 and the same drawing
resolves. Neither grid is the answer on its own, and a conclusion drawn from one
does not transfer.

**Path order is z-order.** `gen:icons` emits paths in source order, so the
sequence in each package's `icons/` definitions is load-bearing wherever a glyph gets
depth from overlap. Reordering paths for tidiness breaks it silently.

Fuller notes from the session that produced these — what stroke weight can and
cannot fix, why rounded corners move numeric constraints, how `currentColor`
behaves across inline / `<img>` / `mask-image`, and the size cost of sampled
curves — are in `clone-icons/STYLE-LESSONS.md` in Mike's iCloud Drive.

## Drawing a glyph

`<Icon name={ref} />` from `@weasel-js/ui` draws the glyph the nearest registry holds, with
`filled` and `mark` for the shaded and badged forms. `resolveIcon(source)` draws a ref or a string
read from data, and `actionIcon(ref)` an action's icon. Outside ui, `useIconGlyph(ref)` from core
returns the glyph itself.

A name the registry lacks draws `core:unknown`'s question mark and warns once in development, and
draws nothing in production. Development is `isDev()` from `@weasel-js/registry` (re-exported by
`@weasel-js/react`), which reads `process.env.NODE_ENV` inside a `try`, so a production bundle
folds it to `false`.

A unit test that draws a glyph mounts a registry holding `kitIcons`, core's and ui's tables
(`@weasel-js/ui/kit-icons`): `renderWithIcons` in `packages/ui/src/testing/withIcons.tsx` in
place of `render`, or its `withIcons` as the `wrapper` of `renderSettled`. A test drawing another
table's glyphs too passes it as `icons`, or builds its wrapper with `iconsWrapper`: apps/draw's and
the site's tests import theirs from each app's `testIcons.ts`. jsdom cannot show
that a glyph drew, so a check of the drawing is a `*.browser.test.tsx`.

## The registry

`createIconRegistry()` from `@weasel-js/icons` holds tables and overrides. Each `add` and
`override` returns its own release, and releasing a table removes only that table's glyphs. It is
not a Reflectable: it keeps its own layer per table and per override for each name, so it does not
appear on the `Reflection` surface other kit registries share.

Core supplies the React side:

| Mount | Registry |
|---|---|
| `<IconRegistryProvider icons variants>` | A registry of its own, holding `icons`; a new `icons` replaces the tables the last one registered |
| `<WeaselProvider icons iconVariants>` | The same, around the provider stack. `isolate` leaves the registry alone |
| `<WeaselProvider>` without either, or `<SceneCanvas>` | An empty one, only when none is in scope |

An app mounts `IconRegistryProvider` at its root, not `WeaselProvider`: a root `WeaselProvider`
would put every canvas under one active-tool and pointer scope.

```tsx
import icons from 'virtual:weasel-icons';

const ICON_VARIANTS = { all: () => import('virtual:weasel-icons/all') };

<IconRegistryProvider icons={icons} variants={ICON_VARIANTS}>
  <App />
</IconRegistryProvider>
```

Without the build plugin, an app passes the tables themselves, each imported as `icons` from
`@weasel-js/core/icons`, `@weasel-js/ui/icons`, `@weasel-js/path-tools/icons`, `@weasel-js/rig/icons` or `@weasel-js/diagram/icons`. The list is a
module constant: the provider releases and registers its tables again whenever the array is a new one.

```tsx
import { icons as coreIcons } from '@weasel-js/core/icons';
import { icons as uiIcons } from '@weasel-js/ui/icons';

const ICONS = [coreIcons, uiIcons];

<IconRegistryProvider icons={ICONS}>
  <App />
</IconRegistryProvider>
```

`kitIcons` from `@weasel-js/ui/kit-icons` is that list of core's and ui's tables, whole.

A component that lists glyphs rather than naming them asks for a variant by name:
`useIconVariant('all')` runs the app's loader once, adds its tables, and returns
`{ entries, state }`. A variant with no loader lists what is already registered.
PrefSchemaEditor's icon picker reads `all`.

## The build plugin

`weaselIcons` from `@weasel-js/icons-plugin` is one unplugin implementation, used as
`weaselIcons.vite(…)`, `.rollup(…)`, `.rolldown(…)` or `.esbuild(…)`. It parses modules with
`oxc-parser`, which is why it is a package of its own: `@weasel-js/icons`, which every kit package
depends on, installs no parser.

It rewrites every call to an `icon` imported by name from a module named `icons.gen.*` into an
annotated, qualified literal, `icon('undo')` becoming `/* @icon */ 'core:undo'`, reading the
namespace from that module's `scopedIcon<…>('ns')` call. A call whose argument is not a literal is
left alone and the build warns; its glyph resolves only from a loaded variant.

| | `mode: 'library'` | `mode: 'app'` |
|---|---|---|
| Used by | Every kit package's build: the tsup preset, labkit's tsup, and core's, ui's and hud's vite builds | apps/draw, the site, the theme editor, the forge app; the `site` and `draw` vitest projects |
| Rewrites `icon()` | Yes | Yes |
| Emits `virtual:weasel-icons` | No | Yes |
| Bundlers | vite, rollup, rolldown, esbuild | vite, rollup, rolldown; esbuild has no hook to fill the virtual modules once every module is seen |

Under any other bundler unplugin supports, the plugin throws: when it is created, or under webpack
and rspack when the compiler applies it.

**Library mode.** `dist` ships the annotated literals and no `icon()` call. esbuild keeps the
comment; rolldown drops plain comments, so the plugin records each module's refs and re-annotates
them in a `renderChunk` ordered `post`. rolldown's output minify, including its default dead-code
pass, strips them again, so core's and ui's vite builds set both `build.minify` and
`rolldownOptions.output.minify` to `false`. A library build fails when any chunk holds a ref its
modules named as a literal with no annotation, in whichever chunk the literal lands.

**App mode.** The plugin collects every `@icon` literal in every module the build transforms,
`node_modules` included. It reads the table beside each `icons.gen` it meets and each package's
`weaselIcons.table`. The build fails on a namespace no table provides, a name missing from its
namespace's table (naming the module that wrote it), and one namespace with two owners.

| Import | Holds |
|---|---|
| `virtual:weasel-icons` | The glyphs the build names |
| `virtual:weasel-icons/all` | Every table found |
| `virtual:weasel-icons/<namespace>` | That namespace, whole |
| `virtual:weasel-icons/<variant>` | A custom variant: `variants: { picker: { namespaces?, groups?, tags? } }` in the plugin options. Each listed field narrows; a glyph needs one of the listed tags |

Each variant is its own chunk, loaded only when something imports it. A custom variant cannot be
named `all`, nor share a namespace's name. The import types come from
`/// <reference types="@weasel-js/icons-plugin/virtual" />`.

In the dev server and under vitest, `virtual:weasel-icons` holds every table the plugin can reach:
vite pre-bundles `node_modules` with esbuild, which never runs the plugin's hooks, so the kit's
refs are invisible there.

Chunk sizes from `npm run build:draw` at `46e968c97`. The last column is what the variant would
weigh, gzipped, if it held only names, groups and tags, with bodies and fills stripped; no build
emits that.

| Variant | Raw | Gzip | Gzip without bodies and fills (hypothetical) |
|---|---:|---:|---:|
| `/all` (core, ui, path-tools, draw) | 156,520 B | 27,688 B | 3,227 B |
| `/draw` | 7,875 B | 1,289 B | 237 B |

An app outside this repo that writes icon names gives the plugin the same shape gen:icons
writes here: a module named `icons.gen.ts` holding
`export const icon = scopedIcon<never>('my-app');`. In this repo a root gets that file from
gen:icons, and `packages/icons/scripts/gen-icons.test.ts` fails on a hand-written `scopedIcon`.

### What the plugin cannot see

| Written as | Result |
|---|---|
| `icon(name)` with a computed `name` | Not rewritten; the build warns, and the glyph needs a loaded variant |
| `import * as g from './icons.gen'; g.icon('x')`, a default import, or a module re-exporting `icon` | Not rewritten; the build warns |
| A name in data, such as a JSON prefs schema | Never collected; the glyph needs a loaded variant |
| A ref in a module the bundler later tree-shakes | Collected anyway, so its glyph ships; a build errs toward too many glyphs, never too few |
| A table generated after the dev server started | Served after a restart |
| A `.vue` or `.svelte` module | Not transformed; only `.js`, `.ts`, `.jsx`, `.tsx` and their `m`/`c` forms are |

Forge registers `kitIcons` whole, plus whatever `FrameSetup.icons` passes
(`apps/forge/forge.frame.tsx` passes path-tools', rig's and draw's), so forge's frames are never trimmed.

## Guards

| Check | Fails when |
|---|---|
| `packages/core/src/icons.refs.test.ts` | An annotated literal in core's source names something outside core's table. `meshKind.ts` writes `/* @icon */ 'core:paintMesh'` by hand, because its self-contained bundle cannot import `icon()` |
| `packages/icons/scripts/gen-icons.test.ts` | A file outside `icons.gen` calls `scopedIcon`, or hands `toIconRef` a literal |
| `scripts/smoke-consumer-icons.mjs` (part of `test:smoke:consumer`) | The packed `@weasel-js/icons-plugin` does not load with only its declared dependencies installed, or a consumer app built with it ships a glyph it does not name outside a variant chunk, or misses one it names through its own `icon()` or through a kit `dist` |
| `scripts/smoke-consumer-bundle.mjs`, its typecheck phase | Against the packed `.d.ts`, a consumer's own `icon()` rejects `core:undo` or `ui:close`, or accepts `core:nope`: core's or ui's `IconName` augmentation did not ship |
