import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  ActionsProvider,
  asNodeId,
  polygonFromPoints,
  useAction,
  withCorner,
  type PolygonPath,
} from '@weasel-js/core';
import { CORNER_CONTROLS_PROMPT, type CornerControlsSelection } from '@weasel-js/path-tools';
import { CornerShape } from './CornerShape';

afterEach(cleanup);

const square = (): PolygonPath =>
  polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);

function setup(selected: number[]) {
  const path = withCorner(withCorner(square(), 0, { shape: 'scoop', radius: 8 }), 1, { shape: 2.5, radius: 8 });
  const scene = { get: (id: unknown) => (id === asNodeId('p') ? { pose: { x: 0, y: 0, width: 100, height: 100 }, data: { path } } : undefined), subscribe: () => () => {} };
  let anchors: ReadonlySet<number> = new Set(selected);
  const listeners = new Set<() => void>();
  const selection: CornerControlsSelection = {
    editingId: () => 'p',
    selectedAnchors: () => anchors,
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
  const run = vi.fn();
  function SetCorners() {
    useAction({ id: 'setCorners', label: 'Set corners', invoker: { timing: 'immediate', run: (_d, params) => run(params) } });
    return null;
  }
  render(
    <ActionsProvider>
      <SetCorners />
      <CornerShape scene={scene} selection={selection} />
    </ActionsProvider>,
  );
  const select = (next: number[]) => act(() => { anchors = new Set(next); listeners.forEach((l) => l()); });
  return { run, select };
}

const keyword = (name: string) => screen.getByRole('radio', { name: new RegExp(`^${name}$`, 'i') });
const curvature = () => screen.getByRole('slider', { name: 'Curvature' }) as HTMLInputElement;

describe('CornerShape', () => {
  it("shows the selected corner's keyword and parameter", () => {
    setup([0]);
    expect(keyword('scoop')).toHaveAttribute('aria-checked', 'true');
    expect(curvature()).toHaveValue('-1');
  });

  it('shows a parameter between the keywords, and goes mixed across corners that differ', () => {
    const t = setup([1]);
    expect(curvature()).toHaveValue('2.5');
    expect(keyword('squircle')).toHaveAttribute('aria-checked', 'false');
    t.select([0, 1]);
    expect(keyword('scoop')).toHaveAttribute('aria-checked', 'false');
  });

  it('sets a keyword or a parameter on the selected corners', () => {
    const t = setup([0]);
    fireEvent.click(keyword('notch'));
    expect(t.run).toHaveBeenLastCalledWith({ shape: 'notch' });
    fireEvent.change(curvature(), { target: { value: '0.5' } });
    expect(t.run).toHaveBeenLastCalledWith({ shape: 0.5 });
  });

  it('disables itself and says what to do with no corner selected', () => {
    setup([]);
    expect(screen.getByText(CORNER_CONTROLS_PROMPT)).toBeInTheDocument();
    expect(keyword('round')).toBeDisabled();
    expect(curvature()).toBeDisabled();
  });
});
