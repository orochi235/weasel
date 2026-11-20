import { watchColorScheme } from '@weasel-js/react';
import { useMemo, type RefObject } from 'react';

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

/** The custom properties an inline `style` attribute sets, in order: what a token override writes. */
function customPropertiesOf(style: string | null): string {
  return (style ?? '').match(/--[^:;\s]+\s*:[^;]*/g)?.map((d) => d.trim()).join(';') ?? '';
}

/** Whether `r`, on an element the canvas sits under, can change a color read off it. An inline
 *  `style` counts only where its custom properties changed, so a transform written each frame does not. */
function themeChanged(r: MutationRecord): boolean {
  const name = r.attributeName;
  if (name === null) return false;
  if (name === 'style') return customPropertiesOf(r.oldValue) !== customPropertiesOf((r.target as Element).getAttribute('style'));
  return THEME_ATTRIBUTE.test(name);
}

const isSheet = (n: Node): boolean => n.nodeName === 'STYLE' || n.nodeName === 'LINK';

/** Whether `r`, under `<head>`, added, removed, rewrote or repointed a stylesheet. */
function sheetChanged(r: MutationRecord): boolean {
  if (r.type === 'characterData') return r.target.parentNode !== null && isSheet(r.target.parentNode);
  if (isSheet(r.target)) return true;
  return [...r.addedNodes, ...r.removedNodes].some(isSheet);
}

/**
 * Hear that the colors read off an element may have changed: a theme, mode or class attribute
 * changing on it or anything above it, a custom property set in an inline `style` there, a
 * `<style>` or `<link>` added to, removed from, rewritten or repointed in `<head>`, or the system color
 * scheme flipping. `el` is read when this is called; with none yet, the document root is
 * watched. Not heard: a rule changed through the CSSOM (`insertRule`, `adoptedStyleSheets`) and
 * a `<link>` finishing its load. Returns the stop.
 */
export function watchThemeOf(el: () => Element | null | undefined, fn: () => void): () => void {
  if (typeof MutationObserver !== 'function' || typeof document === 'undefined') return () => {};
  const observer = new MutationObserver((records) => {
    if (records.some((r) => themeChanged(r))) fn();
  });
  for (let node: Element | null = el() ?? document.documentElement; node; node = node.parentElement) {
    observer.observe(node, { attributes: true, attributeOldValue: true });
  }
  const sheets = new MutationObserver((records) => {
    if (records.some(sheetChanged)) fn();
  });
  if (document.head) sheets.observe(document.head, {
    childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href', 'media', 'disabled'],
  });
  const stopScheme = watchColorScheme(fn);
  return () => {
    observer.disconnect();
    sheets.disconnect();
    stopScheme();
  };
}

/** The color `name` on the element `ref` holds, read when asked, and how to hear it may have changed. */
export function useChromeColor(
  ref: RefObject<Element | null>, name: `--${string}`, fallback: string,
): { read: () => string; changed: (fn: () => void) => () => void } {
  return useMemo(() => ({
    read: () => chromeColorOf(ref.current, name, fallback),
    changed: (fn: () => void) => watchThemeOf(() => ref.current, fn),
  }), [ref, name, fallback]);
}
