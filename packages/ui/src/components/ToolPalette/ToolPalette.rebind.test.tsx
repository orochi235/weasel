import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { useState } from 'react';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { giveKeys } from '@weasel-js/react/testing/giveKeys';
import { key, SceneCanvas, createScene, type BindingOverrides, type ToolsApi } from '@weasel-js/core';
import { formatShortcut } from '@weasel-js/gestures';
import { renderWithIcons } from '../../testing/withIcons';
import { ToolPalette } from './ToolPalette';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

const TOOLS = ['select', 'rect', 'ellipse', 'polygon'] as const;

function setup(initial: BindingOverrides) {
  const scene = createScene({ systemLayers: [{ id: 'main' }] });
  let rebind!: (next: BindingOverrides) => void;
  let api: ToolsApi | null = null;
  function App() {
    const [tools, setTools] = useState<ToolsApi | null>(null);
    const [overrides, setOverrides] = useState(initial);
    rebind = setOverrides;
    api = tools;
    return (
      <>
        {tools && <ToolPalette tools={tools} stacks={[['ellipse', 'polygon']]} />}
        <SceneCanvas features={['draw']} scene={scene} width={64} height={64} defaultTools={TOOLS}
          bindingOverrides={overrides} onToolsCreated={setTools} />
      </>
    );
  }
  renderWithIcons(<App />);
  giveKeys();
  const press = (k: string, init: KeyboardEventInit = {}) =>
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...init })); });
  return { press, rebind: (next: BindingOverrides) => act(() => rebind(next)), active: () => api?.active };
}

const button = (name: RegExp) => screen.getByRole('button', { name });
const tooltipOf = (el: HTMLElement) => {
  fireEvent.keyDown(document.body, { key: 'Tab' });
  act(() => el.focus());
  return screen.getByRole('tooltip').textContent;
};

describe('a rebound tool key reaches the palette', () => {
  it('shows the key a binding override gives, and that key is the one that activates the tool', () => {
    const t = setup({ 'tool.activate.rect': key('Q') });
    expect(button(/rectangle/i)).toHaveTextContent('RectangleQ');
    expect(tooltipOf(button(/rectangle/i))).toMatch(/\(Q\)$/);
    t.press('r');
    expect(t.active()).toBe('select');
    t.press('q');
    expect(t.active()).toBe('rect');
  });

  it('follows a rebind made while the palette is up, and drops the chip of an unbound key', () => {
    const t = setup({});
    expect(button(/rectangle/i)).toHaveTextContent('RectangleR');
    t.rebind({ 'tool.activate.rect': key('Shift+K') });
    expect(button(/rectangle/i)).toHaveTextContent(`Rectangle${formatShortcut({ key: 'K', shift: true })}`);
    t.rebind({ 'tool.activate.rect': null });
    expect(button(/rectangle/i)).toHaveTextContent(/^Rectangle$/);
    t.press('r');
    expect(t.active()).toBe('select');
  });

  it('shows the rebound key on a stack\'s face and in its menu rows', () => {
    setup({ 'tool.activate.ellipse': key('J'), 'tool.activate.polygon': null });
    const stack = button(/ellipse/i);
    expect(stack).toHaveTextContent('EllipseJ');
    fireEvent.click(stack, { detail: 1 });
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /ellipse/i })).toHaveTextContent('J');
    expect(within(menu).getByRole('menuitem', { name: /polygon/i }).textContent).not.toMatch(/G/);
  });
});
