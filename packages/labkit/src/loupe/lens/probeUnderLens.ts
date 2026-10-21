/**
 * What a hit test under the lens layer is for. `'beneath'` stands the lenses' hit boxes down, so a point lands on
 * whatever lies under the layer; `'interior'` stands each lens's interior up, so a point lands on what a lens shows,
 * such as a host's copy of a story inside it.
 */
export type LensProbe = 'beneath' | 'interior';

/**
 * Runs `fn`, a synchronous hit test, with the lens layer holding `el` marked for `kind`, and unmarks it after. The
 * layer takes no pointer of its own, so `elementFromPoint` passes through every lens unless the layer is marked.
 * Outside any lens layer `fn` runs as it is.
 */
export function probeUnderLens<T>(el: Element, kind: LensProbe, fn: () => T): T {
  const layer = el.closest<HTMLElement>('.lk-lens-layer');
  if (!layer) return fn();
  layer.dataset.probe = kind;
  try {
    return fn();
  } finally {
    delete layer.dataset.probe;
  }
}
