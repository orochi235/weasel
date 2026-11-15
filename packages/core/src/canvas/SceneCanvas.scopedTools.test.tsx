import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import { WeaselProvider } from '../WeaselProvider';
import { useScopedTools } from '../tools/toolsScope';
import { drawPreset } from 'canvas/SceneCanvas/presets';
import type { ToolsApi } from '../tools/overlayBinding';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});

function Readout() {
  const tools = useScopedTools();
  return <output>{tools ? `${tools.active}:${Object.keys(tools.registry).length > 0}` : 'none'}</output>;
}

function Canvas({ children }: { children?: React.ReactNode }) {
  const scene = useScene<{ color: string }, 'main', { x: number; y: number; width: number; height: number }>({ systemLayers: [{ id: 'main' }], initial: [] });
  return <SceneCanvas scene={scene} width={100} height={100} features={[drawPreset]}>{children}</SceneCanvas>;
}

describe('useScopedTools', () => {
  it('is null with no canvas in scope', () => {
    render(<WeaselProvider><Readout /></WeaselProvider>);
    expect(screen.getByRole('status').textContent).toBe('none');
  });

  it('reads the tools of a canvas beside it under a WeaselProvider, and follows them as they change', () => {
    let created: ToolsApi | null = null;
    function Spy() {
      const tools = useScopedTools();
      created = tools;
      return null;
    }
    render(<WeaselProvider><Readout /><Spy /><Canvas /></WeaselProvider>);
    expect(screen.getByRole('status').textContent).toBe('select:true');
    act(() => created!.setActive('hand'));
    expect(screen.getByRole('status').textContent).toBe('hand:true');
  });

  it('reads the tools of the canvas it sits in', () => {
    render(<Canvas><Readout /></Canvas>);
    expect(screen.getByRole('status').textContent).toBe('select:true');
  });

  it('lets go of a canvas that unmounts', () => {
    function Toggle() {
      const [shown, setShown] = useState(true);
      return (
        <WeaselProvider>
          <button onClick={() => setShown(false)}>hide</button>
          <Readout />
          {shown && <Canvas />}
        </WeaselProvider>
      );
    }
    render(<Toggle />);
    expect(screen.getByRole('status').textContent).toBe('select:true');
    act(() => screen.getByRole('button').click());
    expect(screen.getByRole('status').textContent).toBe('none');
  });
});
