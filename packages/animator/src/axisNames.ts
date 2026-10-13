/**
 * What an axis of a `T` goes by: a field of a plain object, or a path into a nested one, as a
 * pose's `knee` and `knee.rotation` are. `never` for a number or an array, whose axes have
 * indexes only.
 */
export type AxisName<T> = T extends number | readonly unknown[]
  ? never
  : T extends object
    ? { [K in keyof T & string]: NonNullable<T[K]> extends number ? K : K | `${K}.${string}` }[keyof T & string]
    : string;

/** One of a target's axes: its index, or its name where the target's axes have names. */
export type AxisRef<T = unknown> = number | AxisName<T>;

const LISTED = 8;

/**
 * The indexes `wanted` stands for among `count` axes named `names`. A name answers the axis
 * called exactly that, or every axis under it as a path, in axis order. `what` opens the error
 * for an index out of range or a name nothing answers to.
 */
export function axisIndexes(
  axes: { readonly count: number; readonly names?: readonly string[] },
  wanted: readonly (number | string)[],
  what = 'animator: `axes`',
): number[] {
  const { count, names } = axes;
  const out: number[] = [];
  for (const w of wanted) {
    if (typeof w === 'number') {
      if (!Number.isInteger(w) || w < 0 || w >= count) throw new Error(`${what} names axis ${w} of a target with ${count}`);
      out.push(w);
      continue;
    }
    if (!names) throw new Error(`${what} names "${w}" on a target whose axes have no names`);
    const before = out.length;
    const under = `${w}.`;
    for (let i = 0; i < names.length; i++) {
      if (names[i] === w || names[i]!.startsWith(under)) out.push(i);
    }
    if (out.length === before) {
      const some = names.slice(0, LISTED).map((n) => `"${n}"`).join(', ');
      throw new Error(`${what} names "${w}", and the target's axes are ${some}${names.length > LISTED ? ', …' : ''}`);
    }
  }
  return out;
}
