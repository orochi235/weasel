/**
 * A tool's activation key answers to the canvas's `modes`, whoever built the
 * `ToolsApi`: a consumer's own `useTools` call takes no mode registry, and its
 * tools are still refused by a mode that does not allow them.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createModeRegistry, type ModeDefinition, type ModeRegistry } from '@weasel-js/modes';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import { defineTool, useTools } from '../tools/overlayBinding';
import { WeaselProvider } from '../WeaselProvider';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(() => cleanup());

type P = { x: number; y: number; width: number; height: number };
type Tools = ReturnType<typeof useTools>;

const MODES: ModeDefinition[] = [
  { id: 'look', kind: 'soft', allows: ['selects-objects'], scoping: false },
  { id: 'draw', kind: 'soft', allows: ['selects-objects', 'creates-paths'], scoping: false },
];

const select = defineTool({ id: 'select', keybinding: { key: 'v' }, capabilities: ['selects-objects'] });
const pen = defineTool({ id: 'pen', keybinding: { key: 'p' }, capabilities: ['creates-paths'] });
const untagged = defineTool({ id: 'untagged', keybinding: { key: 'u' } });

function press(key: string) {
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });
}

function mountTakeover(modes: ModeRegistry | undefined) {
  const captured: { tools: Tools | null } = { tools: null };
  function Harness() {
    const scene = useScene<{ color: string }, 'main', P>({ systemLayers: [{ id: 'main' }], initial: [] });
    const tools = useTools({ active: 'select', registry: { select, pen, untagged } });
    captured.tools = tools;
    return (
      <SceneCanvas features={['draw']} scene={scene} width={100} height={100} layers={{}}
        tools={tools} {...(modes ? { modes } : {})} />
    );
  }
  render(<WeaselProvider><Harness /></WeaselProvider>);
  return () => captured.tools!.active;
}

function mountInternal(modes: ModeRegistry) {
  const captured: { tools: Tools | null } = { tools: null };
  function Harness() {
    const scene = useScene<{ color: string }, 'main', P>({ systemLayers: [{ id: 'main' }], initial: [] });
    return (
      <SceneCanvas features={['draw']} scene={scene} width={100} height={100} layers={{}}
        tools={{ pen, untagged }} modes={modes}
        onToolsCreated={(t) => { captured.tools = t; }} />
    );
  }
  render(<Harness />);
  return () => captured.tools!.active;
}

describe('tool activation keys under <SceneCanvas modes>', () => {
  it('refuse a takeover tool the active mode does not allow', () => {
    const modes = createModeRegistry({ modes: MODES, initial: 'look' });
    const active = mountTakeover(modes);
    press('p');
    expect(active()).toBe('select');
  });

  it('reach a takeover tool once the mode allows it, with no re-render in between', () => {
    const modes = createModeRegistry({ modes: MODES, initial: 'look' });
    const active = mountTakeover(modes);
    press('p');
    expect(active()).toBe('select');
    act(() => { modes.setMode('draw'); });
    press('p');
    expect(active()).toBe('pen');
  });

  it('reach a tool that carries no capability tags in any mode', () => {
    const modes = createModeRegistry({ modes: MODES, initial: 'look' });
    const active = mountTakeover(modes);
    press('u');
    expect(active()).toBe('untagged');
  });

  it('reach every takeover tool when the canvas has no modes', () => {
    const active = mountTakeover(undefined);
    press('p');
    expect(active()).toBe('pen');
  });

  it("refuse one of the canvas's own tools the same way", () => {
    const modes = createModeRegistry({ modes: MODES, initial: 'look' });
    const active = mountInternal(modes);
    press('p');
    expect(active()).toBe('select');
    act(() => { modes.setMode('draw'); });
    press('p');
    expect(active()).toBe('pen');
  });
});
