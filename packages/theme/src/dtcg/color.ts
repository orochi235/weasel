/**
 * Hex → `rgba()`. The JS side of the alpha extension; the CSS side emits
 * `color-mix()` instead so DOM chrome keeps tracking a downstream override of
 * the referenced token.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Expected a hex color, got "${hex}"`);

  const body = m[1];
  const full = body.length === 3 ? body.replace(/./g, (c) => c + c) : body;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
