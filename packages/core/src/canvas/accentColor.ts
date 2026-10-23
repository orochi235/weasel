/** The accent canvas chrome paints in when the element sits under no theme. */
export const FALLBACK_ACCENT = '#4c8dff';

/** Read the color custom property `name` off `el`, where the theme cascade lands on a canvas. */
export function chromeColorOf(el: Element | null | undefined, name: `--${string}`, fallback: string): string {
  if (!el || typeof getComputedStyle !== 'function') return fallback;
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/** Read `--wzl-accent` off `el`, where the theme cascade lands on a canvas. */
export function accentColorOf(el: Element | null | undefined): string {
  return chromeColorOf(el, '--wzl-accent', FALLBACK_ACCENT);
}
