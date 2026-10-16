/** Other spellings a legend may take when it overflows its key, keyed by the
 *  legend, in order of preference. A spelling with a `\n` prints on two lines. */
export type KeySpellings = Readonly<Record<string, readonly string[]>>;

/** The default {@link KeySpellings}: shorter words first, then the two-line
 *  forms real keycaps print. */
export const KEY_SPELLINGS: KeySpellings = {
  Control: ['Ctrl'], Option: ['Opt'], Delete: ['Del'], Backspace: ['Bksp', 'Back\nspace'], Return: ['Ret'],
  Super: ['Sup'], PrtSc: ['Prt\nSc'], ScrLk: ['Scr\nLk'], PgUp: ['Pg\nUp'], PgDn: ['Pg\nDn'], Insert: ['Ins'],
};

/** How far a {@link KeyBank}'s legends may shrink before they are left to overflow. */
export const KEY_MIN_SCALE = 0.6;

/** One spelling of a legend, measured: how many lines it prints on and the
 *  largest scale at which it fits its key. */
export interface LegendFit {
  label: string;
  lines: number;
  scale: number;
}

/** What a bank member reports: the largest scale its chosen spelling fits at,
 *  and whether that spelling is a two-line one. */
export interface BankMember {
  scale: number;
  wrapped: boolean;
}

/** The legend itself, then its alternates from `spellings`. */
export function spellingsOf(label: string, spellings: KeySpellings): string[] {
  return [label, ...(spellings[label] ?? [])];
}

/** The scale a legend prints at: never past full size, never below `minScale`. */
export function clampScale(scale: number, minScale: number): number {
  return Math.max(minScale, Math.min(1, scale));
}

/**
 * Picks the spelling a key prints: the first that fits at full size, else —
 * when `wrap` allows — a two-line one that fits at or above `minScale`, else
 * the one that fits at the largest type. With `wrap` off a two-line spelling
 * is chosen only when the legend itself is one.
 */
export function pickSpelling<T extends LegendFit>(
  forms: readonly T[],
  { wrap, minScale }: { wrap: boolean; minScale: number },
): T {
  const allowed = wrap ? forms : forms.filter((f, i) => i === 0 || f.lines === 1);
  const largest = (list: readonly T[]) => list.reduce((a, b) => (b.scale > a.scale + 0.01 ? b : a));
  const whole = allowed.find((f) => f.scale >= 1);
  if (whole) return whole;
  const broken = wrap ? allowed.filter((f) => f.lines > 1 && f.scale >= minScale) : [];
  return broken.length ? largest(broken) : largest(allowed);
}

/**
 * The scale each bank member prints at. Every single-line legend shares one:
 * the smallest any of them needs, floored at `minScale`. A two-line legend
 * sizes itself.
 */
export function resolveBankScales(members: readonly BankMember[], minScale: number): number[] {
  const single = members.filter((m) => !m.wrapped).map((m) => m.scale);
  const shared = clampScale(Math.min(1, ...single), minScale);
  return members.map((m) => (m.wrapped ? clampScale(m.scale, minScale) : shared));
}
