import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ToolsApi } from '../../tools/overlayBinding';
import { useIgnoredProps } from './useIgnoredProps';

const takeover = { setActive: () => {} } as unknown as ToolsApi;

function warnings(run: () => void): string[] {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    run();
    return warn.mock.calls.map(([message]) => String(message));
  } finally {
    warn.mockRestore();
  }
}

describe('useIgnoredProps', () => {
  it('warns once per canvas about the props a ToolsApi takeover ignores', () => {
    const said = warnings(() => {
      const { rerender } = renderHook((p: Parameters<typeof useIgnoredProps>[0]) => useIgnoredProps(p), {
        initialProps: { tools: takeover, defaultTools: ['rect'], defaultActiveTool: 'rect' },
      });
      rerender({ tools: takeover, defaultTools: ['rect'], defaultActiveTool: 'rect', ambient: [] });
      rerender({ tools: takeover, defaultTools: ['rect'] });
    });
    expect(said).toHaveLength(1);
    expect(said[0]).toContain('defaultTools, defaultActiveTool are ignored');
  });

  it('is quiet for the patch form of tools, and for a takeover with nothing else set', () => {
    expect(warnings(() => {
      renderHook(() => useIgnoredProps({ tools: { rect: false }, defaultTools: ['rect'], defaultActiveTool: 'rect' }));
      renderHook(() => useIgnoredProps({ tools: takeover, ambient: [] }));
    })).toEqual([]);
  });

  it('warns about selectTool.pickBest under a takeover', () => {
    const said = warnings(() => {
      renderHook(() => useIgnoredProps({ tools: takeover, selectTool: { pickBest: () => null } }));
    });
    expect(said).toHaveLength(1);
    expect(said[0]).toContain('selectTool.pickBest is ignored');
  });

  it('warns about geometry.picking beside geometry.pickEvery', () => {
    const said = warnings(() => {
      renderHook(() => useIgnoredProps({ geometry: { pickEvery: () => null, picking: 'pixels' } }));
      renderHook(() => useIgnoredProps({ geometry: { picking: 'pixels' } }));
    });
    expect(said).toHaveLength(1);
    expect(said[0]).toContain('`geometry.picking` is ignored');
  });
});
