/** The smallest box a node may be drawn or resized to, in world units. */
export interface MinSize {
  width: number;
  height: number;
}

/** A node's minimum, from `data.minSize`, or `null` when it has none. A
 *  side that is not a positive number holds nothing. */
export function minSizeOf(data: unknown): MinSize | null {
  const m = (data as { minSize?: Partial<MinSize> } | null | undefined)?.minSize;
  if (!m) return null;
  const width = typeof m.width === 'number' && m.width > 0 ? m.width : 0;
  const height = typeof m.height === 'number' && m.height > 0 ? m.height : 0;
  return width > 0 || height > 0 ? { width, height } : null;
}
