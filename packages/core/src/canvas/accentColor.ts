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

const THEME_ATTRIBUTE = /^(data-wzl-|class$)/;

/**
 * Hear that the colors read off an element may have changed: a theme, mode or class attribute
 * changing on it or anything above it, or the system color scheme flipping. `el` is read when
 * this is called; with none yet, the document root is watched. Returns the stop.
 */
export function watchThemeOf(el: () => Element | null | undefined, fn: () => void): () => void {
  if (typeof MutationObserver !== 'function' || typeof document === 'undefined') return () => {};
  const observer = new MutationObserver((records) => {
    if (records.some((r) => r.attributeName !== null && THEME_ATTRIBUTE.test(r.attributeName))) fn();
  });
  for (let node: Element | null = el() ?? document.documentElement; node; node = node.parentElement) {
    observer.observe(node, { attributes: true });
  }
  const scheme = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  scheme?.addEventListener?.('change', fn);
  return () => {
    observer.disconnect();
    scheme?.removeEventListener?.('change', fn);
  };
}
