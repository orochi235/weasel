import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  asPaint,
  registerPaintKind,
  type FillStyle,
  type GradientFill,
} from '@weasel-js/core';
import { PaintInput } from './PaintInput';

const LINEAR: GradientFill = {
  fill: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 1, y: 0 },
  stops: [
    { offset: 0, color: '#ff0000ff' },
    { offset: 1, color: '#0000ffff' },
  ],
  units: 'bounds',
};

const SOLID: FillStyle = { fill: 'solid', color: '#336699ff' };

/** A controlled host, so a kind switch feeds its own next render the way a
 *  panel does — the switch memory is only reachable across renders. */
function Host(props: { initial: FillStyle; onCommit?: (next: FillStyle | null) => void }) {
  const [value, setValue] = useState<FillStyle | null>(props.initial);
  return (
    <PaintInput
      value={value}
      onChange={(next) => {
        setValue(next);
        props.onCommit?.(next);
      }}
    />
  );
}

const clickKind = (label: string): void => {
  fireEvent.click(screen.getByRole('radio', { name: label }));
};

describe('PaintInput', () => {
  it('lists every registered kind in the bar', () => {
    render(<PaintInput value={SOLID} onChange={() => {}} />);
    for (const label of ['Solid', 'Linear', 'Radial', 'Conic', 'Pattern']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
  });

  it('restricts the bar to `kinds` when given', () => {
    render(<PaintInput value={SOLID} kinds={['solid', 'linear-gradient']} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Solid' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Pattern' })).toBeNull();
  });

  it('lights the active kind, and nothing when mixed', () => {
    const { rerender } = render(<PaintInput value={LINEAR} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Linear' })).toBeChecked();

    rerender(<PaintInput value={LINEAR} mixed onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Linear' })).not.toBeChecked();
  });

  it('shows a gradient as a gradient rather than an indeterminate chip', () => {
    const { container } = render(<PaintInput value={LINEAR} onChange={() => {}} />);
    expect(screen.getByLabelText('Stop 1 at 0%')).toBeInTheDocument();
    expect(container.querySelector('[data-mixed]')).toBeNull();
  });

  it('still shows the indeterminate chip when the selection is mixed', () => {
    const { container } = render(<PaintInput value={LINEAR} mixed onChange={() => {}} />);
    expect(container.querySelector('[data-mixed]')).not.toBeNull();
  });

  // The switch precedence, which is the whole point of the memory.
  it('linear -> solid -> linear restores the stops', () => {
    const onCommit = vi.fn();
    render(<Host initial={LINEAR} onCommit={onCommit} />);

    clickKind('Solid');
    expect(onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ color: '#ff0000ff' }));

    clickKind('Linear');
    expect(onCommit).toHaveBeenLastCalledWith(LINEAR);
  });

  it('seeds a kind it has not seen instead of remembering one', () => {
    const onCommit = vi.fn();
    render(<Host initial={SOLID} onCommit={onCommit} />);

    clickKind('Pattern');
    const next = onCommit.mock.calls.at(-1)?.[0] as FillStyle;
    expect(next.fill).toBe('pattern');
    expect(next).toMatchObject({ pattern: { color: '#336699ff' } });
  });

  it('carries gradient geometry across a gradient-to-gradient switch', () => {
    const onCommit = vi.fn();
    render(<Host initial={LINEAR} onCommit={onCommit} />);

    clickKind('Radial');
    const next = onCommit.mock.calls.at(-1)?.[0] as GradientFill;
    expect(next.fill).toBe('radial-gradient');
    expect(next.stops).toEqual(LINEAR.stops);
  });

  it('prefers the memory over a gradient-to-gradient conversion', () => {
    // Radial carries no angle, so conic -> radial -> conic is the round trip
    // a conversion cannot survive. The memory is what restores the angle.
    const CONIC: GradientFill = {
      fill: 'conic-gradient',
      center: { x: 0.5, y: 0.5 },
      angle: 1.2,
      stops: LINEAR.stops,
      units: 'bounds',
    };
    const onCommit = vi.fn();
    render(<Host initial={CONIC} onCommit={onCommit} />);

    clickKind('Radial');
    clickKind('Conic');
    const back = onCommit.mock.calls.at(-1)?.[0] as GradientFill;
    expect(back.fill).toBe('conic-gradient');
    // Converting radial -> conic would have flattened this to 0.
    expect((back as Extract<GradientFill, { fill: 'conic-gradient' }>).angle).toBe(1.2);
  });

  it('offers None, and switching to it commits no paint at all', () => {
    const onCommit = vi.fn();
    render(<Host initial={SOLID} onCommit={onCommit} />);

    clickKind('None');
    expect(onCommit).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('radio', { name: 'None' })).toBeChecked();
  });

  it('shows no editor body for None', () => {
    render(<PaintInput value={null} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'None' })).toBeChecked();
    expect(document.querySelector('input[type="color"]')).toBeNull();
  });

  it('leaving None restores the paint it was remembered from', () => {
    const onCommit = vi.fn();
    render(<Host initial={LINEAR} onCommit={onCommit} />);

    clickKind('None');
    expect(onCommit).toHaveBeenLastCalledWith(null);

    clickKind('Linear');
    // None carries nothing, so the memory has to survive the trip through it.
    expect(onCommit).toHaveBeenLastCalledWith(LINEAR);
  });

  it('omits None when allowNone is false', () => {
    render(<PaintInput value={SOLID} allowNone={false} onChange={() => {}} />);
    expect(screen.queryByRole('radio', { name: 'None' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Solid' })).toBeInTheDocument();
  });
});

describe('PaintInput — a registered kind', () => {
  const disposers: (() => void)[] = [];
  afterEach(() => {
    while (disposers.length) disposers.pop()?.();
  });

  it('appears in the bar and renders its own editor', () => {
    disposers.push(registerPaintKind({
      id: 'noise',
      label: 'Noise',
      seed: (color) => asPaint({ fill: 'noise', color }),
      colorOf: (paint) => (paint as unknown as { color?: string }).color,
      Editor: () => <div data-testid="noise-editor" />,
    }));

    render(<PaintInput value={asPaint({ fill: 'noise', color: '#112233ff' })} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Noise' })).toBeInTheDocument();
    expect(screen.getByTestId('noise-editor')).toBeInTheDocument();
  });

  it('an entry Editor overrides the built-in body for a built-in id', () => {
    disposers.push(registerPaintKind({
      id: 'linear-gradient',
      label: 'Linear',
      seed: () => LINEAR,
      colorOf: (paint) => (paint as GradientFill).stops?.[0]?.color,
      Editor: () => <div data-testid="custom-linear" />,
    }));

    render(<PaintInput value={LINEAR} onChange={() => {}} />);
    expect(screen.getByTestId('custom-linear')).toBeInTheDocument();
    expect(screen.queryByLabelText('Stop 1 at 0%')).toBeNull();
  });
});
