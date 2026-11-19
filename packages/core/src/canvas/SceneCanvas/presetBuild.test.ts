import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { resolveFeatures } from './features';
import { usePresetBuilds, type PresetBuildSource } from './presetBuild';

const snap = { id: 'snap' };
const other = { id: 'other' };

function setup() {
  const build = vi.fn(() => ({}));
  const enabled = resolveFeatures([{ id: 'p', build }]);
  const source = (toolOptions: PresetBuildSource['toolOptions']) => ({ toolOptions } as unknown as PresetBuildSource);
  return { build, enabled, source };
}

describe('usePresetBuilds', () => {
  it('does not rebuild for an inline toolOptions whose array field holds the same values', () => {
    const { build, enabled, source } = setup();
    const { rerender } = renderHook(({ s }) => usePresetBuilds(enabled, s), {
      initialProps: { s: source({ insert: { behaviors: [snap] } } as PresetBuildSource['toolOptions']) },
    });
    rerender({ s: source({ insert: { behaviors: [snap] } } as PresetBuildSource['toolOptions']) });
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('rebuilds when an array field holds another value', () => {
    const { build, enabled, source } = setup();
    const { rerender } = renderHook(({ s }) => usePresetBuilds(enabled, s), {
      initialProps: { s: source({ insert: { behaviors: [snap] } } as PresetBuildSource['toolOptions']) },
    });
    rerender({ s: source({ insert: { behaviors: [other] } } as PresetBuildSource['toolOptions']) });
    expect(build).toHaveBeenCalledTimes(2);
  });
});
