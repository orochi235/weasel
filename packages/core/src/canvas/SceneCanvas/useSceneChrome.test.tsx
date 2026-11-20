import { describe, expect, it } from 'vitest';
import { fireEvent, renderHook } from '@testing-library/react';
import type { NodeId } from 'core/scene/types';
import { never } from 'domains/chrome-caps';
import type { EnabledPresets } from './features';
import { useChromeRules, useSceneCanvasChrome } from './useSceneChrome';

describe('useSceneCanvasChrome', () => {
  it('tracks hover with no chromeVisibility prop and no hover callback, for the rules a dep or a binding sets', () => {
    const el = document.createElement('div');
    const { result } = renderHook(() => useSceneCanvasChrome({
      source: {
        getMode: () => ({ id: 'default' }) as never, getFocused: undefined, resizable: undefined,
        editingAnchors: () => false, device: { canHover: true } as never,
      },
      rules: { enabled: { presets: [] } as never, selectable: true, chromeVisibility: undefined },
      hover: {
        canvasApiRef: { current: { clientToWorld: (x: number, y: number) => [x, y] } as never },
        nodeAtPointRef: { current: (() => ({ id: 'n' })) as never },
      },
      selection: [] as readonly NodeId[],
      viewRef: { current: { x: 0, y: 0, scale: { x: 1, y: 1 } } },
      dispatcher: { getActiveAction: () => ({ kind: null, id: null }) },
    }));
    result.current.trackHoverOn(el);
    fireEvent.pointerMove(el, { clientX: 5, clientY: 5 });
    expect(result.current.getRuleCtx()?.hover).toBe('n');
  });

});

describe('useChromeRules', () => {
  it('keeps the canvas rule for a chromeVisibility key given as undefined', () => {
    const enabled = { presets: [] } as unknown as EnabledPresets;
    const { result } = renderHook(() =>
      useChromeRules({ enabled, selectable: false, chromeVisibility: { 'action.marquee': undefined } }),
    );
    expect(result.current['action.marquee']).toBe(never);
  });
});
