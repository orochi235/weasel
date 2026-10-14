# EffectChart

**Status: unbuilt.** Nothing below exists yet. Written 2026-10-13 on branch
`worktree-effect-chart`. Delete this file when the work merges.

For whoever builds this. It says what EffectChart is, what goes in
`@weasel-js/diagram` to support it, and what the first build has to deliver.

## What it is

A chart of an effects pipeline: the stages, what each one reads and writes, and
where a decision sends the signal. The caller describes the pipeline as data;
EffectChart knows nothing about any particular effect system.

What it should look like is not settled. So the first build is a lab for trying
looks against the same pipelines, and the component is whatever the lab needs
to do that. The parts are split so that trying a new look means writing one
function.

It shows structure only. Showing a run through the pipeline (which branch was
taken, values on wires, cost per stage) and showing one live come later; "Later"
below says what keeps room for them.

It is view-only: pan, zoom, pick a stage. No rewiring.

## The parts

| Part | What it does |
|---|---|
| Pipeline | Plain data: stages, typed ports, wires, groups. Says nothing about appearance. |
| Look | A function from a pipeline to what `diagramScene` takes. One per way of drawing a pipeline. |
| `EffectChart` | A React component. Runs a look over a pipeline and shows the result in a `DiagramView`. |
| Lab | A labkit lab: sample pipelines, a look picker, each look's settings. |

Everything lives in `packages/diagram/src/effect/` and is exported from
`@weasel-js/diagram/effect`.

## Pipeline

```ts
interface EffectPipeline {
  stages: readonly EffectStage[];
  wires: readonly EffectWire[];
  groups?: readonly EffectGroup[];
  /** What the value types mean. A type no entry names is plain data. */
  types?: Readonly<Record<string, EffectType>>;
}

interface EffectStage {
  id: string;
  title: string;
  /** What sort of stage this is, for a look to read. The shipped looks know
   *  'stage' (default), 'decision', 'source' and 'sink', and draw any other
   *  value as 'stage'. */
  kind?: string;
  inputs?: readonly EffectPort[];
  outputs?: readonly EffectPort[];
  /** Settings worth showing, in order. */
  params?: readonly { label: string; value: string }[];
  /** For a decision that splits on a number: the input it compares, and the
   *  cut points in ascending order. N cuts need N + 1 outputs, the lowest
   *  band first. */
  split?: { input: string; at: readonly number[] };
  /** The stage is in the pipeline and switched off. */
  bypassed?: boolean;
  /** Anything else a look wants. No shipped look reads it. */
  data?: Readonly<Record<string, unknown>>;
}

interface EffectPort {
  /** Unique among the stage's inputs and outputs together. */
  id: string;
  /** Default the id. */
  label?: string;
  type: string;
}

interface EffectWire {
  from: { stage: string; port: string };
  to: { stage: string; port: string };
  label?: string;
}

interface EffectGroup {
  id: string;
  label?: string;
  /** Stage ids and group ids. */
  members: readonly string[];
}

interface EffectType {
  /** A control value: a condition, a gate, a modulation source. Looks draw
   *  its wires apart from data wires. */
  control?: boolean;
}
```

A wire's type is its source port's type.

A decision is a stage with `kind: 'decision'`. Its outputs are its exits, and
each exit's label is what a look prints beside it (`yes`, `no`, a case name).
A decision can take a control input like any stage. One with `split` says
which input it tests and where the cuts fall, so a look can draw the threshold
and not only print it.

Color is not in the pipeline. A look's options map a type to a color.

### Checking a pipeline

`checkPipeline(pipeline)` returns the problems it finds, each naming the stage,
port or wire at fault:

- a wire whose stage or port does not exist
- a wire that starts at an input or ends at an output
- a wire joining ports of two different types
- two stages, or two ports on one stage, with the same id
- a group naming a member that does not exist
- a `split` naming an input the stage lacks, with cuts out of order, or with
  the wrong number of outputs for its cuts

It never throws. A look draws a wire that has a problem in a warning color and
leaves out only what cannot be drawn at all (a wire with a missing end), so a
wrong pipeline shows where it is wrong. `EffectChart` reports the problems
through `onProblems`.

## Look

```ts
type EffectLook<TOptions = unknown> = (
  pipeline: EffectPipeline,
  options?: TOptions,
) => { data: DiagramData; scene: DiagramSceneOptions };
```

A look returns `diagramScene`'s two arguments, so everything `diagramScene`
already does (sizing boxes to their text, layout, routing, groups) stays in one
place. Node ids are stage ids and group ids are group ids, so a pick in the
chart names a stage.

Two looks ship in the first build. They were picked because they read a
pipeline most differently.

### `nodeGraph`

| Pipeline | Drawn as |
|---|---|
| Stage | A `rect` box: title row, then a `ports` row per input and output pair (inputs left, outputs right), then a `field` row per param |
| Source, sink | A `stadium` box |
| Decision | One of the branch symbols below, picked by the `branch` option |
| Wire | An edge from port to port in its type's color; dashed for a control type |
| Bypassed stage | Dashed outline, dimmed fill and text |
| Group | A diagram group |

Laid out with `layered`, flowing right. Options: direction, router, gaps,
type colors, whether params show, the branch symbol.

### Branch symbols

How a decision draws is its own choice, shared by every look, so the lab can
try each symbol under each look. A branch symbol is a function from a decision
stage to a diagram node (outline, ports, and whatever it draws inside).

| Symbol | Drawn as | Fits |
|---|---|---|
| `diamond` | The flowchart diamond: inputs on the left and top, exits on the right and bottom, each exit's label on its wire | Any decision. The default when there is no `split`. |
| `bar` | A scale with a tick at each cut and the cut's value beside it; each exit leaves from its own band | A decision with `split`, for any number of cuts. The default when there is one. |
| `demux` | A trapezoid, narrow side in, exits on the wide side, the control input on top | A decision whose condition arrives on a control wire |
| `switch` | A contact thrown toward one exit | Two exits. Kept because a run can show which way it sits. |

`bar` on a decision without `split`, or `switch` on one with more than two
exits, falls back to `diamond`.

A hexagon, a step glyph, a comparator, a crossover and a bare fork with the
conditions on its wires were sketched too and left out of the first build.

Whether a body can draw the bar's ticks and bands or the switch's contact
inside its outline was not checked. `Outline` takes any `Path`, which covers
the trapezoid; marks inside a box may need a new kind of body row.

### `rack`

The main signal runs along one straight line and the stages on it stand in
order, with their params showing. A stage that only feeds another stage from
the side (an oscillator, a mask source, an overlay) sits off the line beside
the stage it feeds.

The main chain is the longest path from a source to a sink over data wires,
unless the options name it. A decision on the main chain whose one exit skips
ahead draws as a bypass arc over the stages it skips, labeled with the
decision's title, and takes no box of its own. Any other decision draws as its
branch symbol.

Options: which stages form the main chain, which side side-inputs sit on,
gaps, type colors, whether a skip-ahead decision collapses to an arc.

## Additions to diagram

Each is general diagram surface, usable without EffectChart.

| Addition | Why | Where |
|---|---|---|
| Ports draw in a view-only `DiagramView` | Today the port layer is only registered when `onConnect` is set, so a chart nobody can rewire shows no ports | `DiagramView.tsx`: a `ports` prop, `'connect'` (today's behavior, the default), `'show'` or `'none'` |
| A port's fill can depend on the port | `PortAffordanceOptions.fill` is one fill for every port, so ports cannot take their type's color | `portAffordance.ts`: `fill` also accepts `(port: Port) => CommandFill` |
| A port can be drawn round | The painted mark is always a square | `portAffordance.ts`: `shape?: 'square' \| 'circle'` |
| `chain` layout | `rack` needs a main chain pinned to one line with the rest hung off it; `layered` has no such notion | `chain.ts`, a `LayoutFn` taking the chain's ids in its options, added to `LAYOUTS` |

Whether the affordance layer can paint a circle, and whether a `ports` row's
label can carry a color, were not checked when this was written. Check both
before planning the port work.

## `EffectChart`

```ts
interface EffectChartProps<TOptions> {
  pipeline: EffectPipeline;
  /** Default `nodeGraph`. */
  look?: EffectLook<TOptions>;
  options?: TOptions;
  width: number;
  height: number;
  /** A stage id, or null. */
  selected?: string | null;
  onSelect?: (stage: string | null) => void;
  onProblems?: (problems: readonly EffectProblem[]) => void;
  className?: string;
}
```

It runs `checkPipeline`, runs the look, calls `diagramScene`, and renders a
`DiagramView` with ports shown. A change of look or of pipeline lays the chart
out again from scratch; a change of selection does not.

## Lab

A labkit lab in `packages/diagram/src/effect/lab/`, shown in the workshop.

- **Sample pipelines:** a straight chain, a branch that merges, a stage with
  several side inputs, a decision that skips a stage, a three-band threshold
  split, and one of about forty stages.
- **Look picker**, and the picked look's options as controls, the branch
  symbol among them.
- **The problems list** for the current pipeline, with one sample that is wrong
  on purpose.

Adding a look to the lab is adding it to one list.

## Tests

- Unit tests for `checkPipeline`: each problem, and a clean pipeline.
- Unit tests per look: a sample pipeline in, the expected nodes, ports and
  edges out. For `rack`, which stages land on the main chain.
- Unit tests per branch symbol: the ports it gives a decision, and each
  fallback to `diamond`.
- Unit tests for `chain`: chain nodes share a line and keep their order; the
  result starts where the graph did.
- A `*.browser.test.tsx` that `EffectChart` mounts, lays out, and reports a
  pick as a stage id.
- A browser test that ports paint in a view-only `DiagramView`, read from the
  framebuffer and not from a class name.
- A site demo and a visual baseline per look.

## Later

Not part of this build. Recorded so the first build does not close them off.

- **A run.** A second input beside the pipeline, keyed by stage id and wire
  (`from` and `to`), never new fields on the pipeline. A look takes it as a
  third argument.
- **Previews.** A stage reserves a body `slot` row and the chart paints into
  it.
- **Live state.** The run changes every frame; only what the run touches
  repaints, and the layout stays put.
- **More looks.** One lane per value type, and a compact look with one-line
  stages and no ports drawn, were sketched alongside these two.
