import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { tryParseColor, watchThemeOf } from '@weasel-js/core';
import { deepEqual } from '@weasel-js/registry';
import type { AuditPalette } from './auditScene';
import s from './palette.module.css';

/** Where the theme gives nothing the renderer can parse (jsdom resolves no `var()`), grays that still tell apart. */
const FALLBACK: AuditPalette = {
  panel: '#f6f6f6', ink: '#1a1a1a', inkInverse: '#ffffff', uncharted: '#d4d4d4', hatch: '#a8a8a8',
  depth: ['#e3edf5', '#b5cfe4', '#7aa6cc', '#3f78a8', '#1d4c75'], settled: '#6fae84', live: '#e0457b',
};

const KEYS = ['panel', 'ink', 'inkInverse', 'uncharted', 'hatch', 'depth0', 'depth1', 'depth2', 'depth3', 'depth4', 'settled', 'live'] as const;
type Key = typeof KEYS[number];

function read(host: HTMLElement): AuditPalette {
  const at = (key: Key, fallback: string): string => {
    const color = getComputedStyle(host.querySelector(`[data-key="${key}"]`)!).color;
    return color && tryParseColor(color) ? color : fallback;
  };
  return {
    panel: at('panel', FALLBACK.panel),
    ink: at('ink', FALLBACK.ink),
    inkInverse: at('inkInverse', FALLBACK.inkInverse),
    uncharted: at('uncharted', FALLBACK.uncharted),
    hatch: at('hatch', FALLBACK.hatch),
    depth: [at('depth0', FALLBACK.depth[0]), at('depth1', FALLBACK.depth[1]), at('depth2', FALLBACK.depth[2]), at('depth3', FALLBACK.depth[3]), at('depth4', FALLBACK.depth[4])],
    settled: at('settled', FALLBACK.settled),
    live: at('live', FALLBACK.live),
  };
}


/**
 * The map's colors, resolved from `palette.module.css` by the browser and read again whenever the theme or
 * the color mode may have changed. Render `probes` inside the element that carries the palette class.
 */
export function useAuditPalette(): { probes: ReactNode; palette: AuditPalette } {
  const ref = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<AuditPalette>(FALLBACK);
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const refresh = () => setPalette((was) => {
      const next = read(host);
      return deepEqual(was, next) ? was : next;
    });
    refresh();
    return watchThemeOf(() => host, refresh);
  }, []);
  const probes = (
    <div ref={ref} className={s.probes} aria-hidden="true">
      {KEYS.map((key) => <span key={key} data-key={key} className={s[key]} />)}
    </div>
  );
  return { probes, palette };
}
