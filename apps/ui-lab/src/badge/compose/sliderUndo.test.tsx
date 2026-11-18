import '../../labTestSetup';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { defineInstrument, Lab } from '@weasel-js/labkit';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addEffect } from '../effects';
import { composeConfig } from './composeConfig';
import { ComposeInstrument } from './ComposeInstrument';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const lab = (shape: Partial<ReturnType<typeof composeConfig.defaults>['shape']>) => [defineInstrument({
  ...ComposeInstrument,
  defaultConfig: () => {
    const config = composeConfig.defaults();
    return { ...config, shape: { ...config.shape, ...shape } };
  },
})];

const undo = () => screen.getByRole('button', { name: 'Undo' });

/** A slider dragged through `values` with a pause longer than an undo step's gap between moves, then let go. */
function dragWithPauses(slider: HTMLElement, values: number[]) {
  for (const value of values) {
    fireEvent.input(slider, { target: { value: String(value) } });
    vi.advanceTimersByTime(2000);
  }
  fireEvent.change(slider, { target: { value: String(values.at(-1)) } });
}

describe('a slider inside a custom row', () => {
  it("is one undo step for the spline's anchor count, however long it pauses", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await renderSettled(<Lab instruments={lab({ base: 'octant-spline' })} />, { wrapper: withIcons });
    const slider = () => screen.getByRole('slider', { name: 'Anchors' });
    expect(slider()).toHaveValue('5');
    dragWithPauses(slider(), [6, 7, 8]);
    expect(slider()).toHaveValue('8');
    fireEvent.click(undo());
    expect(slider()).toHaveValue('5');
    expect(undo()).toBeDisabled();
  });

  it("is one undo step for an effect card's param, however long it pauses", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await renderSettled(<Lab instruments={lab({ effects: addEffect([], 'shadow') })} />, { wrapper: withIcons });
    const open = screen.getByRole('button', { name: 'Drag to reorder Shadow' });
    fireEvent.pointerDown(open, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 10, clientY: 10 });
    const slider = () => screen.getByRole('slider', { name: 'Opacity' });
    expect(slider()).toHaveValue('0.28');
    dragWithPauses(slider(), [0.4, 0.5, 0.6]);
    expect(slider()).toHaveValue('0.6');
    fireEvent.click(undo());
    expect(slider()).toHaveValue('0.28');
    expect(undo()).toBeDisabled();
  });
});
