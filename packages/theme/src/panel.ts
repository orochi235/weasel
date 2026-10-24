/**
 * The slots a theme styles a stanced surface with. A stance is the angle a
 * surface comes from, not a class of content.
 *
 * A stance looks the same on every surface that takes one. A surface reads
 * `--wzl-stance-<stance>-<slot>` first — a nested panel
 * `--wzl-stance-<stance>-nested-<slot>` before that — and falls back to its
 * own base look, so a theme declares only the slots where a stance differs and
 * every other name here is read, with its fallback, and declared by nothing.
 * A panel's base look is itself theme slots, `--wzl-panel-<slot>`.
 */
import { type Stance, STANCES } from './appearance';

export { type Stance, STANCES };

/** One styleable property of a stanced surface. */
export interface StanceSlot {
  readonly name: string;
  /** What it drives, for tooling. */
  readonly drives: string;
}

/** Every slot a theme can set per stance, as `--wzl-stance-<stance>-<slot>`. */
export const STANCE_SLOTS: readonly StanceSlot[] = [
  { name: 'surface', drives: 'background' },
  { name: 'border-color', drives: 'border-color' },
  { name: 'border-style', drives: 'border-style' },
  { name: 'border-width', drives: 'border-width' },
  { name: 'radius', drives: 'border-radius' },
  { name: 'pad', drives: 'padding' },
  { name: 'blur', drives: 'backdrop-filter' },
  { name: 'tint-mix', drives: 'how much of the tint mixes into the surface' },
  { name: 'tint', drives: 'the tint a surface takes when it names none' },
  // Only a surface that names its own tint or grade recolors its controls.
  { name: 'accent', drives: 'the accent the controls inside a tinted or graded surface take; unset, the tint' },
  { name: 'title-font', drives: 'font-family' },
  { name: 'title-weight', drives: 'font-weight' },
  { name: 'title-size', drives: 'font-size' },
  { name: 'title-case', drives: 'text-transform' },
  { name: 'title-tracking', drives: 'letter-spacing' },
  { name: 'title-color', drives: 'color' },
  { name: 'title-inset', drives: 'the title’s padding' },
];

/** Every stance-slot name, `--wzl-`-prefixed, nested variants included. */
export function stanceSlotNames(): string[] {
  return STANCES.flatMap((stance) =>
    STANCE_SLOTS.flatMap((slot) => [`--wzl-stance-${stance}-${slot.name}`, `--wzl-stance-${stance}-nested-${slot.name}`]),
  );
}

/** What `resolveStanceSlots` resolves a surface against, besides its tokens. */
export interface StanceLookup<S extends string> {
  readonly stance?: Stance;
  /** The surface sits inside one of its own kind, and reads `-nested-<slot>` first. */
  readonly nested?: boolean;
  /** A stanced surface's fallback, where it differs from `base`. */
  readonly stanced?: Partial<Readonly<Record<S, string>>>;
}

/**
 * A stanced surface's look, for one drawn without the cascade — a canvas
 * surface reading a resolved theme. The same lookup the generated CSS makes:
 * `--wzl-stance-<stance>-<slot>`, then the stanced fallback, then `base`.
 * `base` holds final values, one per slot the surface draws.
 *
 * The tint is the caller's: a surface that names one mixes it into
 * `surface` at `tint-mix`; one that names none takes the `tint` slot, which
 * falls back to `surface` so mixing it changes nothing.
 */
export function resolveStanceSlots<S extends string>(
  tokens: Readonly<Record<string, string>>,
  base: Readonly<Record<S, string>>,
  { stance, nested, stanced }: StanceLookup<S> = {},
): Record<S, string> {
  const out: Record<S, string> = { ...base };
  if (stance === undefined) return out;
  for (const slot of Object.keys(base) as S[]) {
    const own = tokens[`--wzl-stance-${stance}-${slot}`];
    const inner = nested ? tokens[`--wzl-stance-${stance}-nested-${slot}`] : undefined;
    // A stance's own tint falls back to the surface, never to the surface's base tint.
    const fallback = slot === 'tint' ? (base as Record<string, string>).surface ?? base[slot] : stanced?.[slot] ?? base[slot];
    out[slot] = inner ?? own ?? fallback;
  }
  return out;
}
