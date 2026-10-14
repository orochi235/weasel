import { describe, it, expect } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  ActionsProvider,
  createMeasureActions,
  createMeasurementStore,
  measureBetween,
  useAction,
  type Action,
  type MeasurementStore,
} from '@weasel-js/core';
import { MeasureReadout } from './MeasureReadout';

function Register({ action }: { action: Action }) {
  useAction(action);
  return null;
}

function mount(store: MeasurementStore) {
  const actions = createMeasureActions(store);
  return render(
    <ActionsProvider>
      {actions.map((a) => <Register key={a.id} action={a} />)}
      <MeasureReadout store={store} />
    </ActionsProvider>,
  );
}

describe('MeasureReadout', () => {
  it('shows nothing until something is measured', () => {
    const { container } = mount(createMeasurementStore());
    expect(container.firstChild).toBeNull();
  });

  it('reads the distance, offset, and angle, and offers the commands', () => {
    const store = createMeasurementStore();
    mount(store);
    act(() => store.set(measureBetween({ x: 10, y: 10 }, { x: 40, y: -30 })));
    const values = screen.getAllByRole('status').map((el) => el.textContent);
    expect(values).toEqual(['50.00', '30.00', '−40.00', '−53.13°']);
    expect(screen.getByRole('button', { name: 'Move by' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rotate by' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Measure' })).toBeNull();
  });

  it('greys out the transforms with nothing selected, and clears on Clear', () => {
    const store = createMeasurementStore();
    mount(store);
    act(() => store.set(measureBetween({ x: 0, y: 0 }, { x: 5, y: 0 })));
    expect(screen.getByRole('button', { name: 'Move by' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(store.get()).toBeNull();
  });
});
