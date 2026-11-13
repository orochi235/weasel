import { render, screen } from '@testing-library/react';
import { cssColorLiteral } from '@weasel-js/paint';
import { assert, describe, expect, it, vi } from 'vitest';

// CurveEditor uses weasel's own bundled React and fails in jsdom.
// Mock it out, keeping the props it was handed so a test can play a drag through them.
const editor = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
vi.mock('../CurveEditor', async (importOriginal) => {
  const real = await importOriginal<typeof import('../CurveEditor')>();
  return {
    ...real,
    CurveEditor: (props: Record<string, unknown>) => {
      editor.props = props;
      return null;
    },
  };
});

type Points = { x: number; y: number }[];
const drag = (moves: Points[], settled: Points) => {
  const props = editor.props as { onInput: (p: Points) => void; onChange: (p: Points) => void };
  for (const move of moves) props.onInput(move);
  props.onChange(settled);
};

import { CurveField } from './CurveField';
import s from './CurveField.module.css';

describe('CurveField', () => {
  it('flip button mirrors x → 1-x and resorts', () => {
    const onChange = vi.fn();
    render(
      <CurveField
        values={[0, -1, 0.3, 0.4, 1, 0.7]}
        min={-1}
        max={1}
        step={0.02}
        width={200}
        height={110}
        onChange={onChange}
      />,
    );
    screen.getByRole('button', { name: /flip horizontally/i }).click();
    expect(onChange).toHaveBeenCalledTimes(1);
    // After flip: (0,-1) → (1,-1), (0.3,0.4) → (0.7,0.4), (1,0.7) → (0,0.7).
    // Sort by x ascending: (0,0.7), (0.7,0.4), (1,-1).
    expect(onChange.mock.calls[0][0]).toEqual([0, 0.7, 0.7, 0.4, 1, -1]);
  });

  it('flip vertically mirrors y through (min+max)/2 and keeps x order', () => {
    const onChange = vi.fn();
    render(
      <CurveField
        values={[0, -1, 0.3, 0.4, 1, 0.7]}
        min={-1}
        max={1}
        step={0.02}
        width={200}
        height={110}
        onChange={onChange}
      />,
    );
    screen.getByRole('button', { name: /flip vertically/i }).click();
    expect(onChange).toHaveBeenCalledTimes(1);
    // (min+max)/2 = 0. -1 → 1, 0.4 → -0.4, 0.7 → -0.7. x order preserved.
    expect(onChange.mock.calls[0][0]).toEqual([0, 1, 0.3, -0.4, 1, -0.7]);
  });

  it('flip vertically with [0,1] range mirrors through 0.5', () => {
    const onChange = vi.fn();
    render(
      <CurveField
        values={[0, 0, 0.5, 0.25, 1, 1]}
        min={0}
        max={1}
        step={0.01}
        width={200}
        height={110}
        onChange={onChange}
      />,
    );
    screen.getByRole('button', { name: /flip vertically/i }).click();
    expect(onChange.mock.calls[0][0]).toEqual([0, 1, 0.5, 0.75, 1, 0]);
  });

  it('renders a band mark as a positioned overlay rect', () => {
    const { container } = render(
      <CurveField
        values={[0, 0, 1, 1]}
        min={0}
        max={1}
        step={0.01}
        width={200}
        height={110}
        marks={[{ kind: 'band', x: [0.2, 0.4], color: cssColorLiteral('#ffcc01') }]}
        onChange={() => {}}
      />,
    );
    const overlay = container.querySelector(`.${s.marks}`);
    assert(overlay);
    const rect = overlay.querySelector('rect');
    assert(rect);
    // x = 0.2 * 200 = 40; width = (0.4 - 0.2) * 200 = 40.
    expect(rect.getAttribute('x')).toBe('40');
    expect(rect.getAttribute('width')).toBe('40');
    expect(rect.getAttribute('fill')).toBe('#ffcc01');
  });

  it('renders a line mark as a positioned line', () => {
    const { container } = render(
      <CurveField
        values={[0, 0, 1, 1]}
        min={0}
        max={1}
        step={0.01}
        width={200}
        height={110}
        marks={[{ kind: 'line', x: 0.7, color: { ref: 'accent' } }]}
        onChange={() => {}}
      />,
    );
    const line = container.querySelector(`.${s.marks} line`);
    assert(line);
    expect(line.getAttribute('stroke')).toBe('var(--wzl-accent)');
    expect(line.getAttribute('x1')).toBe('140');
    expect(line.getAttribute('x2')).toBe('140');
  });

  it('omits the marks overlay when marks is undefined', () => {
    const { container } = render(
      <CurveField
        values={[0, 0, 1, 1]}
        min={0}
        max={1}
        step={0.01}
        width={200}
        height={110}
        onChange={() => {}}
      />,
    );
    expect(container.querySelector(`.${s.marks}`)).toBeNull();
  });

  it('reports every move of a drag through onChange when given no onInput', () => {
    const onChange = vi.fn();
    render(<CurveField values={[0, 0, 1, 1]} min={0} max={1} step={0.5} width={200} onChange={onChange} />);
    drag([[{ x: 0, y: 0.2 }, { x: 1, y: 1 }], [{ x: 0, y: 0.4 }, { x: 1, y: 1 }]], [{ x: 0, y: 0.4 }, { x: 1, y: 1 }]);
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([[0, 0, 1, 1], [0, 0.5, 1, 1]]);
  });

  it('sends the moves to onInput and the settled curve to onChange, once, when given onInput', () => {
    const onChange = vi.fn();
    const onInput = vi.fn();
    render(
      <CurveField values={[0, 0, 1, 1]} min={0} max={1} step={0.5} width={200} onChange={onChange} onInput={onInput} />,
    );
    drag([[{ x: 0, y: 0.2 }, { x: 1, y: 1 }], [{ x: 0, y: 0.4 }, { x: 1, y: 1 }]], [{ x: 0, y: 0.4 }, { x: 1, y: 1 }]);
    expect(onInput).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls).toEqual([[[0, 0.5, 1, 1]]]);
  });

  it('disables its buttons while disabled', () => {
    render(
      <CurveField values={[0, 0, 1, 1]} min={0} max={1} step={0.01} width={200} defaults={[0, 0, 1, 1]} onChange={() => {}} disabled />,
    );
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
});
