const HUE_NAMES: readonly (readonly [number, string])[] = [
  [15, 'rose'], [45, 'red'], [62, 'orange'], [85, 'amber'], [100, 'gold'],
  [122, 'yellow'], [138, 'lime'], [165, 'green'], [195, 'teal'], [218, 'cyan'],
  [245, 'sky'], [275, 'blue'], [310, 'violet'], [345, 'fuchsia'],
];
/** A plain color name for a hue in degrees: `red`, `teal`, `violet`. */
export function hueName(H: number): string {
  for (const [ceil, name] of HUE_NAMES) if (H < ceil) return name;
  return 'rose';
}

/** Disambiguate repeats: two hues can land in one name's band. */
export function uniqueNames(hues: number[]): string[] {
  const seen = new Map<string, number>();
  return hues.map((h) => {
    const base = hueName(h);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}
