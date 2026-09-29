/** The accent canvas chrome paints in when the element sits under no theme. */
export const FALLBACK_ACCENT = '#4c8dff';

/** Read `--wzl-accent` off `el`, where the theme cascade lands on a canvas. */
export function accentColorOf(el: Element | null | undefined): string {
  if (!el || typeof getComputedStyle !== 'function') return FALLBACK_ACCENT;
  return getComputedStyle(el).getPropertyValue('--wzl-accent').trim() || FALLBACK_ACCENT;
}
