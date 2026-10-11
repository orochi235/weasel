/**
 * Parse an SVG `viewBox="x y width height"` attribute. Returns undefined
 * on null/empty/malformed input. Numbers may be separated by whitespace
 * and/or commas (SVG spec).
 */
export function parseViewBoxAttr(
  raw: string | null,
): { x: number; y: number; width: number; height: number } | undefined {
  if (raw == null) return undefined;
  const parts = raw.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length !== 4) return undefined;
  const nums = parts.map(parseFloat);
  if (nums.some((n) => !Number.isFinite(n))) return undefined;
  return { x: nums[0], y: nums[1], width: nums[2], height: nums[3] };
}
