# weaselchart fourth arc — design

**Approved and unbuilt (2026-10-20).** The decisions below were taken in conversation, and the
Pieces table was approved as it stands (2026-10-20). Each piece has its own plan under
`docs/superpowers/plans/2026-10-20-chart-arc4-*.md`.

For whoever plans and builds the fourth arc of `apps/chart`. It covers six independent pieces and
says what each one starts from.

## Decisions (2026-10-20)

- **PDF text is real text, with outlines as a fallback.** Each font is embedded whole (no
  subsetting yet), glyphs are written as text, and a ToUnicode map lets the text be selected,
  searched, and copied. A face whose bytes can't be read is drawn as outlines.
- **Audio sources are an audio file and oscillators and noise.** No microphone: the engine has no
  MediaStream source, and it was left out.
- **Audio previews are a scope and a spectrum.** With View › Show Previews on, each stage taps an
  analyser on its output and draws a waveform, with a toggle to a spectrum.
- **Groups under `rack` and `lanes` are drawn by the look and can be edited.** The layout keeps
  members next to each other. A group can be renamed, and dragging its title reorders it as a unit.
  Boxes size to fit, with no resize handles.

## Pieces

| Piece | Starts from | Design |
|---|---|---|
| **PDF export**: `@weasel-js/pdf`, a new package. **Built (2026-10-20).** | No PDF code exists. `planPixelRender` (`packages/core/src/canvas/renderSceneToPixels.ts`) returns `DrawCommand`s, documented for callers targeting their own renderer. The font registry (`packages/font/src/outline/outlineRegistry.ts`) holds each face's bytes, and `opentypeParser.ts` maps a codepoint to its glyph index. | A writer that takes `DrawCommand`s, one PDF page per placed page. Paths, fills, and strokes are drawn as vectors, gradients as PDF shadings, and images are embedded. Text uses Type0/CIDFontType2 fonts with Identity-H encoding, and each glyph sits where the kit's text layout placed it. The package takes the font registry as an input and doesn't import core. weaselchart gets File › Export › Pages as PDF…. |
| **Patchable audio graph** in `@weasel-js/audio` | The engine has voices, fixed buses, and per-bus insert chains that can be changed live with crossfades (`inserts.ts`). It has no general graph. | **Built (2026-10-20).** Nodes can be added and removed, connections made and broken, and params set while the graph plays, with crossfades so nothing clicks. The graph feeds a bus. The engine also gains a looping file source and an analyser tap for any node. |
| **Live audio runner** in `@weasel-js/diagram/effect` | The runner is batch: `createPass` walks the whole run order every time (`runner/pass.ts`), and Play calls it once per frame. | A second runner shape compares each edited pipeline with the previous one and turns the differences into graph patches. The audio stage types are file, oscillator, noise, gain, pan, filter, delay, reverb, compressor, mix, and output. They live apart from the runner, the way `imageEvaluators` does. In pipeline mode the stage palette picks Image or Audio, and Run › Play and Pause start and stop the sound. |
| **Pages in `DiagramData`** | Chart mode's off-page split is an edit pass on a live scene (`packages/diagram/src/offPage/install.ts`). `DiagramData` (`dataTypes.ts`) has no pages, so neither does pipeline mode, which is data-backed through `EffectEditor`. | **Built (2026-10-20).** `DiagramData` gains `pages`. A node belongs to the page whose rect it sits on, the same rule chart mode uses. The connector split moves into a pure function that both the edit pass and `diagramScene` call, so there's one copy of it. Pipeline mode shows pages under `nodeGraph` only. |
| **Dragging an edge label** | `DataEdge.labelPlacement` (`labelTrait.ts`) stored `at` as a route fraction plus an `offset`, and `dodge: false` stopped placement moving it. | **Built (2026-10-20).** A drag writes `at` (route fraction), `offset`, and `dodge: false`, so the label follows the edge when it's rerouted. Format › Connector › Reset label clears all three. It works in chart mode and in a data-backed `DiagramView`. |
| **Groups under `rack` and `lanes`** | `rack.ts` and `lanes.ts` drew groups as `DataGroup` boxes fitted after layout, so a box could cover stages that aren't members. Rename was gated to `nodeGraph` (`groupTitle.tsx`). | **Built (2026-10-20).** The `chain` and `lanes` layouts keep members contiguous. Rename works in both looks, and dragging a group's title reorders the group as a unit. |

## Testing

Each piece gets unit tests.

- **PDF:** a browser test reads the exported file back and checks its page count and extracted
  text.
- **Audio:** a browser test renders through an `OfflineAudioContext` and checks that patching a
  running graph doesn't reset a delay's tail.
- **Label drag and group reorder:** pointer tests in the browser project.

## Order

There are two waves of parallel worktrees:

1. PDF, the patchable audio graph, label drag, and the group layouts.
2. The live audio runner, which needs the graph, and pages in `DiagramData`.

## Not in this arc

Microphone input, font subsetting, and resizing group boxes under `rack` and `lanes`.
