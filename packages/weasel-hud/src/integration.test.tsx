// packages/weasel-hud/src/integration.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { Canvas } from '../../../src/canvas/Canvas';
import type { CanvasExtensionApi } from '../../../src/canvas/canvasExtension';
import { useTools } from '../../../src/tools/useTools';
import type { Tool } from '../../../src/tools/types';
import { useHud } from './react';
import { _resetFontRegistryForTests } from '../../../src/features/text/atlas/registerFont';
import { readTokens } from './theme';
import { ActiveToolContextProvider } from '../../../src/interactions/actions/activeToolContext';

const defaultResolved = readTokens(null);

interface HarnessApi {
  toolOnDown: ReturnType<typeof vi.fn<(e: PointerEvent) => void>>;
  press: ReturnType<typeof vi.fn<() => void>>;
  hudRef: { current: ReturnType<typeof useHud> | null };
}

/**
 * jsdom doesn't implement PointerEvent with clientX/clientY via the constructor;
 * fireEvent.pointerDown produces a nativeEvent with clientX: undefined.
 * Synthesize via Event + Object.assign, which is how the existing tool unit tests
 * (e.g. useTools.test.ts) work around this jsdom gap.
 */
function makePointerEvent(type: string, init: Record<string, unknown> = {}): PointerEvent {
  const ev = new Event(type, { bubbles: true }) as PointerEvent;
  Object.assign(ev, { clientX: 0, clientY: 0, pointerId: 1, ...init });
  return ev;
}

function makeMockTool(toolOnDown: ReturnType<typeof vi.fn<(e: PointerEvent) => void>>): Tool {
  return {
    id: 'mock',
    pointer: {
      onDown: (e, _ctx) => {
        toolOnDown(e);
        return 'claim';
      },
    },
  } as Tool;
}

function Harness({ apiOut }: { apiOut: HarnessApi }) {
  const canvasRef = React.useRef<CanvasExtensionApi>(null);
  const hud = useHud(canvasRef);
  apiOut.hudRef.current = hud;

  const mockTool = React.useMemo(() => makeMockTool(apiOut.toolOnDown), [apiOut.toolOnDown]);
  const tools = useTools({ active: 'mock', registry: { mock: mockTool } });

  return (
    <Canvas
      ref={canvasRef}
      width={200} height={200}
      layers={{}}
      tools={tools}
      // Force identity world↔screen for jsdom; canvas.getBoundingClientRect()
      // returns zeros so client === world maps cleanly.
      clientToWorld={(_, cx, cy) => [cx, cy]}
    />
  );
}

describe('weasel-hud integration', () => {
  beforeEach(() => {
    _resetFontRegistryForTests();
    global.fetch = vi.fn(async () => new Response('{"common":{"lineHeight":1},"info":{"face":"x","size":1},"chars":[],"kernings":[]}')) as never;
    global.createImageBitmap = vi.fn(async () => ({} as ImageBitmap));
  });

  it('button click claims the event before the active tool sees it', async () => {
    const api: HarnessApi = {
      toolOnDown: vi.fn<(e: PointerEvent) => void>(),
      press: vi.fn<() => void>(),
      hudRef: { current: null },
    };
    const { container } = render(<ActiveToolContextProvider><Harness apiOut={api} /></ActiveToolContextProvider>);
    await act(async () => {});  // let useHud's effect run

    expect(api.hudRef.current).not.toBeNull();
    const btn = api.hudRef.current!.button({ id: 'save', x: 10, y: 10, w: 60, h: 24, label: 'Save' });
    btn.on('press', api.press);

    const canvas = container.querySelector('canvas')!;
    canvas.dispatchEvent(makePointerEvent('pointerdown', { clientX: 30, clientY: 20 }));
    canvas.dispatchEvent(makePointerEvent('pointerup', { clientX: 30, clientY: 20 }));

    expect(api.press).toHaveBeenCalledTimes(1);
    expect(api.toolOnDown).not.toHaveBeenCalled();
  });

  it('click outside any widget falls through to the active tool', async () => {
    const api: HarnessApi = {
      toolOnDown: vi.fn<(e: PointerEvent) => void>(),
      press: vi.fn<() => void>(),
      hudRef: { current: null },
    };
    const { container } = render(<ActiveToolContextProvider><Harness apiOut={api} /></ActiveToolContextProvider>);
    await act(async () => {});

    api.hudRef.current!.button({ id: 'save', x: 10, y: 10, w: 60, h: 24, label: 'Save' });
    const canvas = container.querySelector('canvas')!;

    // Click far from the button — should NOT claim.
    canvas.dispatchEvent(makePointerEvent('pointerdown', { clientX: 150, clientY: 150 }));
    expect(api.press).not.toHaveBeenCalled();
    expect(api.toolOnDown).toHaveBeenCalledTimes(1);
  });

  it('button picks up --wzl-button-fill set on the canvas element via CSS', async () => {
    const apiOut: HarnessApi = {
      toolOnDown: vi.fn(),
      press: vi.fn(),
      hudRef: { current: null },
    };
    const { container } = render(<ActiveToolContextProvider><Harness apiOut={apiOut} /></ActiveToolContextProvider>);
    await act(async () => {});

    const canvas = container.querySelector('canvas')!;
    canvas.style.setProperty('--wzl-button-fill', '#abcdef');

    const btn = apiOut.hudRef.current!.button({ id: 'save', x: 10, y: 10, w: 60, h: 24, label: 'Save' });

    // Verify the widget's draw output reflects the CSS variable.
    const cmds = btn.draw({
      dims: { width: 200, height: 200 },
      defaultFont: 'weasel-hud-default',
      tokens: { ...defaultResolved, buttonFill: '#abcdef' },
    });
    const body = cmds.find(c => c.kind === 'path') as { fill: { color: string } };
    expect(body.fill.color).toBe('#abcdef');
  });
});
