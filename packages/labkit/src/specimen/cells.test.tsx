import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { ActionDisabledReason, type ActionsRegistry } from '@weasel-js/routing';
import {
  ActionsProvider, ActiveToolContextProvider, DepRegistryProvider, useActionsRegistry, useCommand, useGestureDispatcher,
} from '@weasel-js/routing/react';
import { createToastQueue, ToastRegion } from '@weasel-js/ui/components/Toast';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ButtonsAndToggles } from './ButtonsAndToggles';
import { OverlaysAndFeedback } from './OverlaysAndFeedback';
import { PanelsAndRows } from './PanelsAndRows';
import { ShapePanelCell } from './ShapePanelCell';
import { SliderCells } from './SliderCells';

// Each cell shows its control in a small working state (`Specimen`'s doc): every control on it answers.

describe('specimen cells', () => {
  it('moves the Rings slider by a key step and keeps it there', () => {
    renderWithIcons(<ShapePanelCell />);
    fireEvent.click(screen.getByRole('button', { name: /Bevel/ }));
    const rings = screen.getByRole('slider', { name: /Rings/ }) as HTMLInputElement;
    // A key step as a browser delivers it: one input, then the change that ends it.
    fireEvent.input(rings, { target: { value: '33' } });
    fireEvent.change(rings);
    expect(Number(rings.value)).toBe(33);
  });

  it('hides the sidebar panel from its hide button and brings it back', () => {
    renderWithIcons(<PanelsAndRows />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide panel' }));
    expect(screen.queryByText('2 items selected')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show panel' }));
    expect(screen.getByText('2 items selected')).toBeInTheDocument();
  });

  it('docks the right sidebar after a main area, on the box edge it names', () => {
    renderWithIcons(<PanelsAndRows />);
    const sidebar = screen.getByRole('complementary', { name: 'Specimen sidebar' });
    expect(sidebar.previousElementSibling?.classList.contains('lk-specimen__box-main')).toBe(true);
  });

  it('names the momentary SegmentedBar toolbar', () => {
    renderWithIcons(<ButtonsAndToggles />);
    for (const bar of screen.getAllByRole('toolbar')) expect(bar).toHaveAccessibleName();
  });

  it('cancels an InlineRange drag on Escape, back to the width it started at', () => {
    renderWithIcons(<SliderCells />);
    const range = screen.getByLabelText<HTMLInputElement>('Width');
    const from = range.value;
    fireEvent.pointerDown(range, { pointerId: 1, button: 0 });
    fireEvent.input(range, { target: { value: String(Number(from) + 5) } });
    fireEvent.keyDown(range, { key: 'Escape' });
    expect(range.value).toBe(from);
  });
});

function Refused() {
  const registry = useActionsRegistry() as ActionsRegistry;
  useCommand('edit.duplicate', 'Duplicate', () => {}, {
    keys: { kind: 'key', key: 'd' },
    enabled: () => ActionDisabledReason.SelectionRequired,
  });
  useGestureDispatcher({
    canvasRef: { current: null }, actions: registry, entriesById: new Map(),
    channels: { contextMenu: false, ingest: false }, keyboard: 'page',
  });
  return null;
}

describe('the specimen toast demo', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('leaves a refused command to the host app region', () => {
    renderWithIcons(
      <DepRegistryProvider>
        <ActionsProvider>
          <ActiveToolContextProvider>
            <Refused />
            <ToastRegion queue={createToastQueue()} className="host" />
            <OverlaysAndFeedback />
          </ActiveToolContextProvider>
        </ActionsProvider>
      </DepRegistryProvider>,
    );
    fireEvent.keyDown(document.body, { key: 'd' });
    act(() => { vi.advanceTimersByTime(1); });
    const told = screen.getAllByText('Selection required');
    expect(told).toHaveLength(1);
    expect(told[0]!.closest('.host')).not.toBeNull();
  });
});
