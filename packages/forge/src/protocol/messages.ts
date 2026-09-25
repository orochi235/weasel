import type { SchemaDescription } from './schema.ts';

export const PROTOCOL_VERSION = 1;

export type Globals = Readonly<Record<string, unknown>>;
export type Layout = 'centered' | 'padded' | 'fullscreen';
export interface Viewport {
  width: number;
  height: number;
}
export type FaultPhase = 'import' | 'render' | 'play' | 'protocol';

/** One custom property as the frame found it. */
export interface CssVarReport {
  name: string;
  value: string;
  /** Whether a `vars.set` override is in force on it. */
  overridden: boolean;
}

/** Visibility and validation answers, keyed by the config they were computed for. */
export interface ConfigAnswers {
  /** `stableStringify(config)` of the config the frame evaluated. */
  configKey: string;
  hidden: string[];
  errors: Record<string, string[]>;
}

/** One element axe faulted on, inside the frame's own document. */
export interface A11yNode {
  /** The CSS selectors, outermost first, that reach the element in the frame. */
  target: readonly string[];
  html: string;
  failureSummary?: string;
}

/** One axe rule's outcome on the story, with the elements it names. */
export interface A11yFinding {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  help: string;
  helpUrl: string;
  description: string;
  nodes: readonly A11yNode[];
}

/** What axe found on one story: the rules it failed, and the ones it could not decide. */
export interface A11yReport {
  violations: readonly A11yFinding[];
  incomplete: readonly A11yFinding[];
  /** Rules that passed, and rules no element on the page could be judged by. */
  passes: number;
  inapplicable: number;
}

/** A picture of the story the frame can put in a message: labkit's `CaptureSource` without the canvas,
 *  which no structured clone carries. */
export type CapturedPicture = { kind: 'svg'; markup: string } | { kind: 'image'; src: string };

export type ToFrame =
  | { type: 'init'; config: unknown; state: unknown; globals: Globals }
  | { type: 'config'; config: unknown }
  | { type: 'state'; state: unknown }
  | { type: 'globals'; globals: Globals }
  | { type: 'vars.set'; name: string; value: string | null }
  | { type: 'play' }
  /** Run axe over the story's own subtree. Answered by `a11y` carrying the same `id`. */
  | { type: 'a11y.run'; id: string }
  /** Serialize the story's own subtree as a picture. Answered by `capture` carrying the same `id`. */
  | { type: 'capture.run'; id: string };

export type FromFrame =
  | { type: 'ready'; schema: SchemaDescription; layout: Layout; viewport: Viewport | null }
  /** Sent once, when the story's first render after `init` has committed. */
  | { type: 'rendered' }
  | { type: 'answers'; answers: ConfigAnswers }
  | { type: 'setConfig'; path: string; value: unknown }
  | { type: 'setState'; state: unknown }
  | { type: 'size'; width: number; height: number }
  | { type: 'vars'; vars: CssVarReport[] }
  /** Asks the shell to show story `id` in this frame's trial in place of what it shows now. */
  | { type: 'open'; id: string }
  | { type: 'played'; ok: boolean; message?: string }
  | { type: 'a11y'; id: string; ok: true; report: A11yReport }
  | { type: 'a11y'; id: string; ok: false; message: string }
  | { type: 'capture'; id: string; ok: true; picture: CapturedPicture }
  | { type: 'capture'; id: string; ok: false; message: string }
  /** `seq`, on a render fault only: how many `init`/`config`/`state`/`globals` messages the frame had received. */
  | { type: 'fault'; phase: FaultPhase; message: string; stack?: string; seq?: number };

export interface Envelope<M> {
  v: number;
  msg: M;
}

/** Posted on the frame's window with the port transferred alongside it, as a `PortHandoff`. */
export const PORT_HANDOFF = 'weaselforge:port';

/** What the shell posts with the port: `id` names what the frame shows, a story or an index. */
export interface PortHandoff {
  type: typeof PORT_HANDOFF;
  id: string;
}

/** Posted by a frame document to its parent as soon as its entry runs, asking for a port. */
export const FRAME_HELLO = 'weaselforge:hello';

/** JSON with object keys sorted, so two equal configs produce one key. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );
}
