import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { icon } from '../icons.gen';
import { useStrokeClickTool, type StrokeClickToolSpec } from './strokeClickTool';

const spec: StrokeClickToolSpec = {
  id: 'snip', label: 'Snip', icon: icon('trim'), hookName: 'useSnipTool', actionId: 'snip', keybinding: { key: 'k' },
};

describe('useStrokeClickTool', () => {
  it('carries the spec’s description into its presentation', () => {
    const { result } = renderHook(() => useStrokeClickTool({ ...spec, description: 'Cut a stroke' }, {}));
    expect(result.current.presentation).toMatchObject({ label: 'Snip', description: 'Cut a stroke', group: 'path' });
  });
});
