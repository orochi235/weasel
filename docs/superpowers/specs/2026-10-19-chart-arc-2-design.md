# weaselchart (`apps/chart`), second arc — design

**Piece 4 unbuilt as of 2026-10-20.** Pieces 1, 2, 3, 5, and 6 have landed; the diagram README and `docs/concepts.md` describe them.

For whoever builds each piece of the second arc. It says what the user does and sees in
weaselchart, which engine surface each piece adds and where, how it saves and undoes, and which
tests prove it. Read `CLAUDE.md` ("Scope", "What gets its own package", "Module shape",
"Terminology") and `docs/taxonomy.md` first; this doc does not restate them.

The first arc (merged; its spec deleted, readable at
`git show 89e332f4d:docs/superpowers/specs/2026-10-19-chart-app-design.md`) set the rules this arc
keeps: every editing ability is engine surface in `@weasel-js/diagram` or core, each editing action
has a swappable commit (scene ops by default, a data-edit callback for a data-backed host such as
`DiagramView` or `EffectEditor`), and the app only proves it. labkit will reuse all of it.

## Build order

Each piece lands in its own worktree and merges on its own green `npm run test:fleet` and
`npm run test:gate`. Foundations land with the first piece that needs them.

| # | Piece | Core foundation it adds | Needs |
|---|---|---|---|
| 4 | Themes | — | — |

The suggested order holds.

Every piece also: writes `patch` changesets; keeps files under 400 lines and functions under 120
(`npm run check:size`); exports only public surface to the app; updates the diagram README's
editing section and `docs/TODO.md` in its merge; and, when it merges, deletes its own section of
this doc (the doc is deleted with the last piece).

## 4. Themes

### What the user sees

Format › Theme picks a document theme; the page, every shape, connector, label, container, and lane
recolor at once, and one undo puts them back. A new right-hand Format sidebar holds a Style picker
for the selected shapes or connectors, built on `PropertyPanel`, listing the theme's roles (Default, Accent, Muted, Positive, Warning,
Negative) as swatches. A color the user set by hand survives a theme change.

### The model

**A theme writes literal colors into the scene; nothing resolves a theme at paint time
(2026-10-19).** Every reader of the scene (the renderer, SVG export, hit-testing, another app
opening the file) keeps working with no theme in hand, and the ownership rule is the one layout
already uses for waypoints (`laidOut`): the theme owns a color until the author sets it.

### Engine surface (`packages/diagram/src/theme/`)

- `types.ts`: `DiagramTheme { id; name; roles: Record<string, NodeStyle>; defaultRole; edge:
  EdgeStyle; label: { fill; font? }; container: NodeStyle; lane: { header: NodeStyle; bodies:
  NodeStyle[] }; page: string; font: { family; size }; series: string[] }`, reusing `NodeStyle` and
  `EdgeStyle` from `fromData.ts`. `DIAGRAM_ROLES` names the shared role ids.
- `themes.ts`: `DIAGRAM_THEMES`: `paper` (chart's current ink on white, so existing charts are
  unchanged), `night` (today's dark defaults in `effect/draw.ts` and `lanes.ts`, so `EffectChart`
  is unchanged), `blueprint`, `pastel`, and `mono`.
- `fromTokens.ts`: `diagramThemeFromTokens(read: (token: string) => string)` builds a theme from
  resolved `--wzl-*` values, so a diagram can match its host's chrome. It takes a reader, so
  diagram gains no dependency on `@weasel-js/theme`.
- Traits: `style?: string` (a role id) on `DiagramNode` (`trait.ts`) and `DiagramEdge`
  (`edgeTrait.ts`), and `ownStyle?: readonly StyleField[]` listing what the author set by hand.
- `themeWrites(scene, theme) → Map<NodeId, data>` (pure) and `applyDiagramTheme(scene, theme,
  label)`, which writes them and the `diagram:theme` doc value in one batch. Body text rows take
  their role's text color and the theme's font family; a row's own size stays.
- `setDiagramStyle(scene, ids, role)`; a hand edit of a fill or stroke adds to `ownStyle`.
- Inserts read the theme: `useStencilInsert`, `diagramPorts`, `useConnectorTool`, and
  `editEdgeLabelAction` already take a style (735990028, 2026-10-19), and chart builds those
  styles from the current theme. `CHART_NODE_STYLE`, `CHART_EDGE_STROKE`, `CHART_LABEL_FILL`, and
  `CHART_PAGE_COLOR` in `chartDocument.ts` are deleted.
- Data-backed: `DiagramSceneOptions.theme` resolves `DataNode.style` roles in `diagramScene`; the
  effect looks take `theme` in their options and read `sceneStyles`, lane fills, and `typeColors`'
  palette (`series`) from it. Type colors stay the look's, drawn from the theme's series.

### Save, load, undo

The `diagram:theme` doc value holds a built-in theme's id or a whole custom `DiagramTheme`. Nodes
hold literal colors, so a file opens right even where the theme is unknown. Applying a theme is one
entry; setting a role is one entry.

### Tests

- `themeWrites.test.ts`: `ownStyle` respected; rows, edges, labels, containers recolored.
- `theme.scene.test.ts`: one undo restores every color and the doc value.
- `fromTokens.test.ts`; `fromData.test.ts` role resolution; the effect looks under `night` give
  today's colors exactly.
- Chart browser test: switch theme, read the page fill and a shape fill back from the canvas
  pixels, undo.

## Third arc (not designed)

- Off-page reference markers for connectors that cross pages, and export of one page.
- Containers and swimlanes in data-backed `DiagramData`, after `DiagramView` reports resizes.
- Edge labels as routing obstacles, and labels that dodge each other.
- Line jumps (hops) where connectors cross.
- Pipeline-mode groups as editable containers; waypoint editing under the `rack` and `lanes` looks.
- Theme editing in the app (a theme builder), beyond picking and assigning roles.
- Importing and exporting other diagram tools' files, and running a pipeline, still out from the
  first arc.
