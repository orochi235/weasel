import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ActionsProvider } from '@orochi235/weasel';
import { RegistryProbe } from './registryProbe';

// jsdom doesn't implement getContext or pointer capture; stub minimally so
// SceneCanvas can mount and synthesize tools/actions. Done at module scope
// (not in beforeAll) so it's in place before render() during the first test.
{
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      canvas: { width: 0, height: 0 },
      clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
      save: vi.fn(), restore: vi.fn(), translate: vi.fn(), setTransform: vi.fn(),
      scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
      fillText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
      font: '', textBaseline: '', globalAlpha: 1,
      fillStyle: '', strokeStyle: '', lineWidth: 1,
    })),
  });
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
}

describe('RegistryProbe', () => {
  it('reports tool and action entries after mount', async () => {
    const snapshots: { tools: readonly { id: string }[]; actions: readonly { id: string }[] }[] = [];
    const onSnapshot = (s: { tools: readonly { id: string }[]; actions: readonly { id: string }[] }) => {
      snapshots.push(s);
    };
    render(
      <ActionsProvider>
        <RegistryProbe onSnapshot={onSnapshot} />
      </ActionsProvider>,
    );
    await waitFor(() => {
      const last = snapshots[snapshots.length - 1];
      expect(last).toBeTruthy();
      expect(last!.tools.length).toBeGreaterThan(3);
      expect(last!.actions.length).toBeGreaterThan(3);
    });
    const last = snapshots[snapshots.length - 1]!;
    const toolIds = last.tools.map((t) => t.id);
    expect(toolIds).toContain('rect');
  });
});
