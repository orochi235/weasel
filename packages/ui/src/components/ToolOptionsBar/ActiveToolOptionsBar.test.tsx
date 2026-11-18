import { act, fireEvent, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createToolOptionValues, defineTool, type ToolOptionsSpec } from '@weasel-js/routing';
import { SceneCanvas, WeaselProvider, createScene } from '@weasel-js/core';
import { pref, PX_UNIT } from '@weasel-js/prefs';
import { renderWithIcons } from '../../testing/withIcons';
import { ActiveToolOptionsBar } from './ActiveToolOptionsBar';

const prefs = pref.group('Brush', {
  radiusPx: pref.number('Size', 16, { min: 4, max: 120, step: 1, control: 'slider', unit: PX_UNIT }),
});
const OPTIONS: ToolOptionsSpec = { actionId: 'brush', prefs };
const brush = defineTool({ id: 'brush', options: OPTIONS, presentation: { label: 'Brush' } });
const select = defineTool({ id: 'select' });

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).getContext = vi.fn(() => null);
});

describe('ActiveToolOptionsBar', () => {
  it('follows the active tool of the canvas beside it under a WeaselProvider, with no tools prop', () => {
    const values = createToolOptionValues();
    const scene = createScene({ systemLayers: [{ id: 'main' }] });
    renderWithIcons(
      <WeaselProvider>
        <ActiveToolOptionsBar values={values} />
        <SceneCanvas scene={scene} width={64} height={64} tools={{ brush }} defaultActiveTool="brush" toolOptionValues={values} />
      </WeaselProvider>,
    );
    expect(screen.getByRole('toolbar', { name: 'Brush' })).toBeInTheDocument();
  });

  it("draws the tool's options, and writes a change to where the host keeps them", () => {
    const values = createToolOptionValues();
    renderWithIcons(<ActiveToolOptionsBar tool={brush} values={values} />);
    expect(screen.getByRole('toolbar', { name: 'Brush' })).toBeInTheDocument();
    act(() => { fireEvent.change(screen.getByRole('slider', { name: /Size/ }), { target: { value: '41' } }); });
    expect(values.get('brush').radiusPx).toBe(41);
  });

  it('follows a step made elsewhere, such as a key', () => {
    const values = createToolOptionValues();
    renderWithIcons(<ActiveToolOptionsBar tool={brush} values={values} />);
    act(() => values.set('brush', 'radiusPx', 80));
    expect(screen.getByRole('slider', { name: /Size/ })).toHaveValue('80');
  });

  it("follows the active tool of a canvas's tools", () => {
    const values = createToolOptionValues();
    const registry = { brush, select };
    const { rerender } = renderWithIcons(<ActiveToolOptionsBar tools={{ active: 'brush', registry }} values={values} />);
    expect(screen.getByRole('toolbar', { name: 'Brush' })).toBeInTheDocument();
    rerender(<ActiveToolOptionsBar tools={{ active: 'select', registry }} values={values} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('draws nothing for a tool with no options', () => {
    const { container } = renderWithIcons(<ActiveToolOptionsBar tool={select} values={createToolOptionValues()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
