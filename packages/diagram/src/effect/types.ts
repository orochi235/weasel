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
}

/** What one stage did in a run. */
export interface EffectStageRun {
  /** How long it took, in milliseconds. */
  cost?: number;
  /** For a decision: the output it chose. */
  taken?: string;
  /** What each output carried, by port id, as text to show. */
  values?: Readonly<Record<string, string>>;
  /** What each output carried, by port id, as a picture, drawn in the slot a
   *  look keeps for it (`showPreviews`). A bitmap rather than a canvas
   *  because its pixels cannot change: hand back the same one and nothing is
   *  uploaded again; draw new pixels into a new one. */
  previews?: Readonly<Record<string, ImageBitmap>>;
}

/** What a value type means, as `EffectPipeline.types` records it. */
export interface EffectType {
  /** A control value: a condition, a gate, a modulation source. Looks draw
   *  its wires apart from data wires. */
  control?: boolean;
}
