import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { RedrawSource } from '../../core/layers/render';
import { useSceneRedrawSources } from './useSceneRedrawSources';

const source = (): RedrawSource => ({ subscribe: () => () => {} });

function sourcesFor(pathEdit: { subscribe?: RedrawSource['subscribe'] } | undefined) {
  const scene = { ...source(), overrides: source() };
  const { result } = renderHook(() => useSceneRedrawSources({
    props: { pathEdit },
    scene,
    heldModifiers: source(),
    departures: source(),
  }));
  return result.current;
}

describe('useSceneRedrawSources', () => {
  it('repaints on a path-edit host that says when it changes', () => {
    const host = { editingId: () => null, setEditingId: () => {}, ...source() };
    expect(sourcesFor(host)).toContain(host);
  });

  it('leaves out a host with nothing to subscribe to', () => {
    const host = { editingId: () => null, setEditingId: () => {} };
    expect(sourcesFor(host)).not.toContain(host);
  });
});
