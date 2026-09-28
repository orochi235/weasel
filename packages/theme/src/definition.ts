import type { AxisDefs, Varying } from './axes.ts';
import type { SerializableColorList } from './colorList.ts';
import type { TokenValue } from './dtcg/types.ts';

/** A number, or `{seeds.name}`. */
export type NumberParam = Varying<number | string>;

/** A pin with its metadata. `type` defaults to that of the token it replaces. */
export interface PinObject {
  readonly value: TokenValue;
  readonly type?: string;
  readonly description?: string;
  /** Render the referenced color at this alpha, 0–1. */
  readonly alpha?: number;
}

/** A bare value or `{ value, type?, description?, alpha? }`. The value may be a `{token}` reference. */
export type PinValue = TokenValue | PinObject;

/** A ramp that walks lightness between two ends at one hue, or between anchor colors. */
export interface LightnessRampDef {
  readonly kind: 'lightness';
  readonly steps: Varying<readonly string[]>;
  /** First and last step's OKLCH lightness. */
  readonly lightness: Varying<readonly [NumberParam, NumberParam]>;
  /** 0 walks evenly; 1 follows a smoothstep S. */
  readonly curve?: NumberParam;
  /** Degrees. Ignored when an anchor is given. */
  readonly hue?: NumberParam;
  readonly chroma?: Varying<{ readonly peak: NumberParam; readonly lightBias?: NumberParam; readonly darkBias?: NumberParam }>;
  /**
   * Step name → exact hex (or `{seeds.name}`). An anchor's hue and chroma replace `hue` and `chroma.peak`; with several,
   * both blend by step between consecutive anchors, and steps outside them take the nearest anchor's.
   */
  readonly anchor?: Varying<Readonly<Record<string, Varying<string>>>>;
  readonly description?: string;
  readonly describe?: Readonly<Record<string, string>>;
}

/** A ramp of distinct hues from the palette generator, one per step. */
export interface CategoricalRampDef {
  readonly kind: 'categorical';
  readonly steps: Varying<readonly string[]>;
  /** Any of the palette generator's `Constraints` except `count` and `anchors`. */
  readonly gates?: Varying<Readonly<Record<string, Varying<number | string>>>>;
  readonly anchors?: readonly { readonly name: string; readonly hue: number; readonly lightness: number; readonly chroma?: number }[];
  readonly description?: string;
  readonly describe?: Readonly<Record<string, string>>;
}

/** A named color ramp: each step becomes a token `<ramp>-<step>`. */
export type RampDef = LightnessRampDef | CategoricalRampDef;

/**
 * A named dimension scale in whole px: each step becomes a token `<scale>-<step>`. Give exactly one of `step`,
 * `ratio` or `factors`.
 */
export interface ScaleDef {
  readonly steps: Varying<readonly string[]>;
  readonly base: NumberParam;
  /** Linear: `base + step × i`. */
  readonly step?: NumberParam;
  /** Geometric: `base × ratio^i`. */
  readonly ratio?: NumberParam;
  /** Explicit: `base × factors[i]`, one per step. For a ramp no single rule fits. */
  readonly factors?: Varying<readonly NumberParam[]>;
  readonly description?: string;
  readonly describe?: Readonly<Record<string, string>>;
}

interface SemanticCommon {
  readonly type?: string;
  readonly description?: string;
  /** Audited, never applied. */
  readonly check?: { readonly contrast: number; readonly against: readonly string[] };
}

/** A named step of a ramp. */
export type StepRule = SemanticCommon & { readonly ramp: string; readonly step: Varying<string> };
/**
 * `offset` steps from wherever `from` lands on its ramp. `away` moves toward the ramp's farther end; `lighter` and
 * `darker` read which end is which from the ramp's colors.
 */
export type OffsetRule = SemanticCommon & { readonly from: string; readonly offset: number; readonly dir: 'lighter' | 'darker' | 'away' };
/**
 * The step of `ramp` nearest the surfaces that clears WCAG `contrast.min` against every token in `against`. When no
 * step does, the best one is used and a `contrast-unmet` issue reported.
 */
export type ContrastRule = SemanticCommon & { readonly ramp: string; readonly contrast: { readonly min: number; readonly against: readonly string[] } };
/** An alias of another token, optionally at an alpha. */
export type RefRule = SemanticCommon & { readonly ref: string; readonly alpha?: number };
/** A fixed value. */
export type LiteralRule = SemanticCommon & { readonly value: TokenValue };
/** How a semantic token derives its value. */
export type SemanticRule = StepRule | OffsetRule | ContrastRule | RefRule | LiteralRule;

/**
 * A layered theme as authored. Seeds feed the layers after them; ramps, scales, semantics and components each
 * produce their own tokens, and naming one token twice among them is an issue. A pin replaces the token of its name,
 * or adds one.
 */
export interface ThemeDefinition {
  readonly name: string;
  /** Another definition's name. Absent or null: extends nothing. */
  readonly extends?: string | null;
  readonly description?: string;
  readonly axes?: AxisDefs;
  readonly seeds?: Readonly<Record<string, Varying<number | string>>>;
  readonly ramps?: Readonly<Record<string, RampDef>>;
  readonly scales?: Readonly<Record<string, ScaleDef>>;
  readonly semantics?: Readonly<Record<string, Varying<SemanticRule>>>;
  readonly components?: Readonly<Record<string, Varying<PinValue>>>;
  readonly pins?: Readonly<Record<string, Varying<PinValue>>>;
  /** The colors a `tone` index picks from. Absent: the nearest theme it extends that has one, else the swatch ramp. */
  readonly tones?: SerializableColorList;
}
