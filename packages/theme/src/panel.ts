/**
 * The vocabulary of stances, and the slots a theme styles a stanced surface with.
 *
 * A stance looks the same on every surface that takes one. A surface reads
 * `--wzl-stance-<stance>-<slot>` first — a nested panel
 * `--wzl-stance-<stance>-nested-<slot>` before that — and falls back to its
 * own base look, so a theme declares only the slots where a stance differs and
 * every other name here is read, with its fallback, and declared by nothing.
 * A panel's base look is itself theme slots, `--wzl-panel-<slot>`.
 */

/** What kind of content a surface holds — a class of content, never a position. */
export const STANCES = ['scope', 'aside', 'advanced', 'debug', 'danger', 'notice', 'important', 'preview'] as const;

export type Stance = (typeof STANCES)[number];

/** One styleable property of a stanced surface. */
export interface StanceSlot {
  readonly name: string;
  /** What it drives, for tooling. */
  readonly drives: string;
}

export const STANCE_SLOTS: readonly StanceSlot[] = [
  { name: 'surface', drives: 'background' },
  { name: 'border-color', drives: 'border-color' },
  { name: 'border-style', drives: 'border-style' },
  { name: 'border-width', drives: 'border-width' },
  { name: 'radius', drives: 'border-radius' },
  { name: 'pad', drives: 'padding' },
  { name: 'blur', drives: 'backdrop-filter' },
  { name: 'tone-mix', drives: 'how much of the tone mixes into the surface' },
  { name: 'tone', drives: 'the tone a surface takes when it names none' },
  // Only a surface that names its own tone recolors its controls.
  { name: 'accent', drives: 'the accent the controls inside a surface with a tone take; unset, the tone' },
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
 * The tone is the caller's: a surface that names one mixes it into
 * `surface` at `tone-mix`; one that names none takes the `tone` slot, which
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
    // A stance's own tone falls back to the surface, never to the surface's base tone.
    const fallback = slot === 'tone' ? (base as Record<string, string>).surface ?? base[slot] : stanced?.[slot] ?? base[slot];
    out[slot] = inner ?? own ?? fallback;
  }
  return out;
}
