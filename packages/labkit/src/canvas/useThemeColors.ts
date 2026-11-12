import { chromeColorOf, watchThemeOf } from '@weasel-js/core';
import { useEffect, useState } from 'react';

/** Each color's custom property and the color used when nothing sets it. */
export type ThemeColorSpec<K extends string> = Readonly<
  Record<K, readonly [`--${string}`, string]>
>;

/**
 * The colors `spec` names, read off `el` and read again whenever the theme over it may have changed, for a canvas
 * drawn in the theme's colors. `null` until there is an element. The record keeps its identity while the colors do,
 * so it can stand in an effect's dependencies. Pass a `spec` that keeps its identity.
 */
export function useThemeColors<K extends string>(
  el: Element | null,
  spec: ThemeColorSpec<K>,
): Readonly<Record<K, string>> | null {
  const [colors, setColors] = useState<Readonly<Record<K, string>> | null>(null);
  useEffect(() => {
    if (!el) return;
    const read = () =>
      setColors((prev) => {
        const keys = Object.keys(spec) as K[];
        const next = Object.fromEntries(
          keys.map((k) => {
            const [name, fallback] = spec[k];
            return [k, chromeColorOf(el, name, fallback)];
          }),
        ) as Record<K, string>;
        return prev && keys.every((k) => prev[k] === next[k]) ? prev : next;
      });
    read();
    return watchThemeOf(() => el, read);
  }, [el, spec]);
  return el ? colors : null;
}
