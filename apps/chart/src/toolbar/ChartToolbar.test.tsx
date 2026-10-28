import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { ActionsProvider, DepRegistryProvider } from '@weasel-js/core';
import { App } from '../App';
import { chartPrefs } from '../prefs';
import { withIcons } from '../testIcons';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}) },
  );
});
afterEach(() => {
  cleanup();
  chartPrefs().reset();
  localStorage.clear();
});

const mount = () => render(
  <DepRegistryProvider>
    <ActionsProvider>
      <App />
    </ActionsProvider>
  </DepRegistryProvider>,
  { wrapper: withIcons },
);

const toolbar = () => screen.getByRole('toolbar', { name: 'Chart' });
const group = (name: string) => within(toolbar()).getByRole('group', { name });
const commit = (field: HTMLElement, value: string) => {
  act(() => {
    fireEvent.change(field, { target: { value } });
    fireEvent.blur(field);
  });
};

describe('ChartToolbar', () => {
  it('draws each asset as its own group of buttons', () => {
    mount();
    for (const [name, buttons] of [
      ['History', ['Undo', 'Redo']],
      ['Zoom', ['Zoom Out', 'Zoom In', 'Fit page']],
      ['Grid and snapping', ['Show grid', 'Snap to grid', 'Snap to other shapes', 'Snap to equal gaps']],
      ['Connector', ['Straight', 'Orthogonal', 'Curved', 'Around shapes', 'Line jumps']],
      ['Arrange', ['Auto layout']],
    ] as const) {
      for (const button of buttons) expect(within(group(name)).getByRole('button', { name: button })).toBeTruthy();
    }
    expect(within(group('Tools')).getByRole('toolbar', { name: 'Tools' })).toBeTruthy();
  });

  it('toggles the snapping prefs, each button pressed while its pref is on', () => {
    mount();
    const shapes = within(group('Grid and snapping')).getByRole('button', { name: 'Snap to other shapes' });
    expect(shapes.getAttribute('aria-pressed')).toBe('true');
    act(() => { fireEvent.click(shapes); });
    expect(chartPrefs().get('view.alignmentSnap')).toBe(false);
    expect(shapes.getAttribute('aria-pressed')).toBe('false');
    act(() => { fireEvent.click(within(group('Grid and snapping')).getByRole('button', { name: 'Snap to equal gaps' })); });
    expect(chartPrefs().get('view.spacingSnap')).toBe(false);
  });

  it('writes a typed grid spacing to the pref', () => {
    mount();
    commit(within(group('Grid and snapping')).getByRole('spinbutton', { name: 'Spacing' }), '24');
    expect(chartPrefs().get('view.gridSpacing')).toBe(24);
  });

  it('zooms to a typed percentage', () => {
    mount();
    const zoom = within(group('Zoom')).getByRole('spinbutton', { name: 'Zoom' }) as HTMLInputElement;
    commit(zoom, '250');
    expect(zoom.value).toBe('250');
  });
});
