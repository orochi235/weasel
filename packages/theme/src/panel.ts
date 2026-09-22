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
