import type { SchemaDescription } from './schema.ts';

export const PROTOCOL_VERSION = 1;

/** The workshop's toolbar globals as a story reads them, by name. */
export type Globals = Readonly<Record<string, unknown>>;
/** How a story sits in its frame. */
export type Layout = 'centered' | 'padded' | 'fullscreen';
/** The layout a story takes when it names none, in either story format. */
export const DEFAULT_LAYOUT: Layout = 'padded';
/** A frame size a story asks for, in CSS pixels. */
export interface Viewport {
  width: number;
  height: number;
}
/** Where a frame's fault happened: loading the story, rendering it, or reading a message. */
export type FaultPhase = 'import' | 'render' | 'protocol';

/** One custom property as the frame found it. */
export interface CssVarReport {
  name: string;
  value: string;
  /** Whether a `vars.set` override is in force on it. */
  overridden: boolean;
  /** Whether the story reads it, directly or through another property it reads. */
  used: boolean;
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
  /** On a node axe could not decide: why, as axe's message key (`bgOverlap`, `pseudoContent`, …) and its own sentence. */
  reason?: { key?: string; message?: string };
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

/** What an axe run in the frame came back with. */
export type A11yOutcome = { ok: true; report: A11yReport } | { ok: false; message: string };

/** A message the workshop sends a story's frame. */
export type ToFrame =
  | { type: 'init'; config: unknown; state: unknown; globals: Globals }
  | { type: 'config'; config: unknown }
  | { type: 'state'; state: unknown }
  | { type: 'globals'; globals: Globals }
  | { type: 'vars.set'; name: string; value: string | null }
  /** Run axe over the story's own subtree. Answered by `a11y` carrying the same `id`. */
  | { type: 'a11y.run'; id: string }
  /** Outlines the elements each `A11yNode.target` reaches, in place of the last ones; an empty list clears. */
  | { type: 'a11y.highlight'; targets: readonly (readonly string[])[] }
  /** Scrolls the frame document to `left`, `top` in CSS px: a lens's copy following its trial's frame. */
  | { type: 'scroll'; left: number; top: number };

/** A message a story's frame sends the workshop. */
export type FromFrame =
  | { type: 'ready'; schema: SchemaDescription; layout: Layout; viewport: Viewport | null }
  /** Sent once, when the story's first render after `init` has committed. */
  | { type: 'rendered' }
  | { type: 'answers'; answers: ConfigAnswers }
  | { type: 'setConfig'; path: string; value: unknown }
  | { type: 'setState'; state: unknown }
  | { type: 'vars'; vars: CssVarReport[] }
  /** Asks the shell to show story `id` in this frame's trial in place of what it shows now. */
  | { type: 'open'; id: string }
  | ({ type: 'a11y'; id: string } & A11yOutcome)
  /** Where the frame document stands, in CSS px: sent once after `ready`, then whenever it scrolls. */
  | { type: 'scroll'; left: number; top: number }
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

export { stableStringify } from '@weasel-js/core';
