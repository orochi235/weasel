// A digit has no upper case, so `star-4` has to drop the dash rather than try to
// capitalize it — an emitted `shapeStar-4` is not a valid object key.
export const camel = (k) => k.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

// Join with a space (attributes split across lines must stay separated),
// then close the gaps between adjacent elements.
const clean = (body) =>
  body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/>\s+</g, '><');

// A drawn glyph arrives as a string of markup; a plotted one arrives as
// { d, width, inner, fill, rule, join } and is turned into markup here, so the definitions stay
// geometry and the emitter stays the only place that writes elements.
export const element = (glyph) =>
  typeof glyph === 'string'
    ? clean(glyph)
    : `<path d="${glyph.d}"${glyph.join ? ` stroke-linejoin="${glyph.join}"` : ''}` +
      `${glyph.width ? ` stroke-width="${glyph.width}"` : ''}/>` +
      (glyph.inner ? `<path d="${glyph.inner.d}" stroke-width="${glyph.inner.width}"/>` : '');

export const fillElement = (glyph) =>
  typeof glyph === 'string' || !glyph.fill
    ? null
    : `<path d="${glyph.fill}" fill="currentColor" stroke="none"` +
      `${glyph.rule ? ` fill-rule="${glyph.rule}"` : ''}/>`;

export function checkMark(key, body) {
  if (body.includes('stroke-width')) {
    throw new Error(`mark "${key}" sets a stroke-width, which the slot would scale down with it`);
  }
}
