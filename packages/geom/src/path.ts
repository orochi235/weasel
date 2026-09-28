/** Minimal path input: a rect or a polygon command stream. geom does not
 *  import @weasel-js/core's `Path`; core's `Path` is structurally this shape. */
export type GeomPath =
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  | { kind: 'polygon'; commands: ArrayLike<number>; coords: ArrayLike<number>; fillRule?: 'nonzero' | 'evenodd' };
