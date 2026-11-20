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

/**
 * A distinct name for each hue. A `fixed` name, an anchor's own, is claimed first and the rest are named for their hue;
 * a repeat of either takes the next free `-2`, `-3`.
 */
export function uniqueNames(hues: readonly number[], fixed: readonly (string | undefined)[] = []): string[] {
  const taken = new Set<string>();
  const claim = (base: string) => {
    let name = base;
    for (let n = 2; taken.has(name); n += 1) name = `${base}-${n}`;
    taken.add(name);
    return name;
  };
  const out = hues.map((_, i) => (fixed[i] === undefined ? undefined : claim(fixed[i])));
  return hues.map((h, i) => out[i] ?? claim(hueName(h)));
}
