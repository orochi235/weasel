import type { Page } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';

/** An effects pipeline as plain data. It says what is wired to what and
 *  nothing about how any of it is drawn. */
export interface EffectPipeline {
  stages: readonly EffectStage[];
  wires: readonly EffectWire[];
  groups?: readonly EffectGroup[];
  /** What the value types mean. A type no entry names is plain data. */
  types?: Readonly<Record<string, EffectType>>;
}

/** One step of a pipeline: what it reads and writes, and what its box shows. */
export interface EffectStage {
  id: string;
  title: string;
  /** What sort of stage this is, for a look to read. The shipped looks know
   *  'stage' (default), 'decision', 'source' and 'sink', and draw any other
   *  value as 'stage'. */
  kind?: string;
  /** Which palette entry or template made this stage. A tag for an editor to
   *  read: no shipped look draws differently for it. */
  type?: string;
  inputs?: readonly EffectPort[];
  outputs?: readonly EffectPort[];
  /** Settings worth showing, in order. */
  params?: readonly EffectParam[];
  /** For a decision that splits on a number: the input it compares, and the
   *  cut points in ascending order. N cuts need N + 1 outputs, the lowest
   *  band first. */
  split?: { input: string; at: readonly number[] };
  /** The stage is in the pipeline and switched off. */
  bypassed?: boolean;
  /** Anything else a look wants. No shipped look reads it. */
  data?: Readonly<Record<string, unknown>>;
}

/** One input or output of a stage, carrying a value of one type. */
export interface EffectPort {
  /** Unique among the stage's inputs and outputs together. */
  id: string;
  /** Default the id. */
  label?: string;
  type: string;
}

/** A connection from one stage's output to another stage's input. */
export interface EffectWire {
  /** Carried to the drawn edge's `DataEdge.id`, so the wire can be found again. */
  id?: string;
  from: { stage: string; port: string };
  to: { stage: string; port: string };
  /** Drawn on the wire. */
  label?: string;
}

/** A box drawn around some stages, and around other groups. */
export interface EffectGroup {
  id: string;
  label?: string;
  /** Stage ids and group ids. */
  members: readonly string[];
}

/** One run of a pipeline: what happened, beside the pipeline rather than in
 *  it, so it can change every frame while the pipeline and its layout stay
 *  put. A stage the run has no entry for is one it never reached. */
export interface EffectRun {
  stages: Readonly<Record<string, EffectStageRun>>;
  /** The stage a run taken a step at a time is on, drawn outlined. */
  at?: string;
}

/** What one stage did in a run. */
export interface EffectStageRun {
  /** How long it took, in milliseconds. */
  cost?: number;
  /** For a decision: the output it chose. */
  taken?: string;
  /** What each output carried, by port id, as text to show; for a stage with
   *  no outputs, what reached each input. */
  values?: Readonly<Record<string, string>>;
  /** What each port `values` covers carried, by port id, as a picture, drawn in the slot a
   *  look keeps for it (`showPreviews`). A bitmap rather than a canvas
   *  because its pixels cannot change: hand back the same one and nothing is
   *  uploaded again; draw new pixels into a new one. */
  previews?: Readonly<Record<string, ImageBitmap>>;
  /** Why the stage failed, written where its cost goes. What it feeds is
   *  left unreached. */
  error?: string;
}

/** What a value type means, as `EffectPipeline.types` records it. */
export interface EffectType {
  /** A control value: a condition, a gate, a modulation source. Looks draw
   *  its wires apart from data wires. */
  control?: boolean;
}

/** How a param is edited, and the value it holds. */
export type EffectParamControl =
  | { kind: 'number'; value: number; min?: number; max?: number; step?: number; unit?: string }
  | { kind: 'enum'; value: string; options: readonly { value: string; label?: string }[] }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'string'; value: string };

/** One setting a stage shows. `value` is the display string; `control`, when
 *  present, is what an editor changes and `value` is its formatted form. */
export interface EffectParam {
  /** Addresses the param when labels repeat; the label stands in when absent. */
  id?: string;
  label: string;
  value: string;
  control?: EffectParamControl;
}

/** Where each stage sits, by stage id, beside the pipeline rather than in it. */
export type EffectPlaces = Readonly<Record<string, Vec2>>;

/** A pipeline and where its stages sit: what an editor holds and changes. */
export interface EffectDoc {
  pipeline: EffectPipeline;
  places: EffectPlaces;
  /** The pages the stages are drawn across under `nodeGraph`, beside the
   *  pipeline as `places` is. A wire between stages on different pages is
   *  drawn as two stubs with off-page tags. The other looks ignore them. */
  pages?: readonly Page[];
  /** The value types whose lanes the `lanes` look draws first, top down. */
  laneOrder?: readonly string[];
  /** The waypoints a person routed each wire through under `nodeGraph`, by
   *  wire id, beside the pipeline as `places` is. */
  routes?: Readonly<Record<string, readonly Vec2[]>>;
  /** The routes a person drew under `rack` and `lanes`, by look, then by wire id. */
  lookRoutes?: LookRoutes;
  /** Each group's box under `nodeGraph`, by group id, beside the pipeline as
   *  `places` is. A group with none fits its members. */
  groupBoxes?: Readonly<Record<string, EffectBox>>;
}

/** A box on the page, in world units. */
export interface EffectBox { x: number; y: number; width: number; height: number }

/** A wire's route under a look that places its stages itself. */
export interface LookRoute {
  waypoints: readonly Vec2[];
  /** Where the wire's from and to ports were when it was routed. The route
   *  is drawn only while they are still there: a reorder or an added stage
   *  moves stages, and a route drawn for one arrangement means nothing in another. */
  ends: readonly [Vec2, Vec2];
}

/** `EffectDoc.lookRoutes`. */
export interface LookRoutes {
  rack?: Readonly<Record<string, LookRoute>>;
  lanes?: Readonly<Record<string, LookRoute>>;
}
