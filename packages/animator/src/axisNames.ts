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

/** Whether axis `i` is reached by the name `w`: as its own name, or as the start of its path. */
function reaches(
  names: readonly string[], paths: readonly (readonly string[])[] | undefined, i: number, w: string,
): 'name' | 'path' | null {
  if (names[i] === w) return 'name';
  const path = paths?.[i];
  if (!path) return names[i]!.startsWith(`${w}.`) ? 'path' : null;
  let joined = '';
  for (let k = 0; k < path.length - 1; k++) {
    joined = k === 0 ? path[0]! : `${joined}.${path[k]}`;
    if (joined === w) return 'path';
    if (joined.length >= w.length) return null;
  }
  return null;
}

/**
 * The indexes `wanted` stands for among `count` axes named `names`. A name answers the axis
 * called exactly that, or every axis under it as a path, in axis order. Where `paths` gives each
 * axis's path, a path's steps are those and no others, so a step may hold a dot (`spine.001`);
 * without it, every dot in a name is a step. `what` opens the error for an index out of range, a
 * name nothing answers to, or a name that is both one axis's and the start of another's path.
 */
export function axisIndexes(
  axes: { readonly count: number; readonly names?: readonly string[]; readonly paths?: readonly (readonly string[])[] },
  wanted: readonly (number | string)[],
  what = 'animator: `axes`',
): number[] {
  const { count, names, paths } = axes;
  const out: number[] = [];
  for (const w of wanted) {
    if (typeof w === 'number') {
      if (!Number.isInteger(w) || w < 0 || w >= count) throw new Error(`${what} names axis ${w} of a target with ${count}`);
      out.push(w);
      continue;
    }
    if (!names) throw new Error(`${what} names "${w}" on a target whose axes have no names`);
    const before = out.length;
    let asName = false;
    let asPath = false;
    for (let i = 0; i < names.length; i++) {
      const how = reaches(names, paths, i, w);
      if (!how) continue;
      out.push(i);
      if (how === 'name') asName = true;
      else asPath = true;
    }
    if (paths && asName && asPath) {
      throw new Error(`${what} names "${w}", which is both an axis and the start of other axes' paths`);
    }
    if (out.length === before) {
      const some = names.slice(0, LISTED).map((n) => `"${n}"`).join(', ');
      throw new Error(`${what} names "${w}", and the target's axes are ${some}${names.length > LISTED ? ', …' : ''}`);
    }
  }
  return out;
}
