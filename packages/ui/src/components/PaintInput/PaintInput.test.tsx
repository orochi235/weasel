import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { act, cleanup, screen, fireEvent, within } from '@testing-library/react';
import {
  asPaint,
  registerPaintKind,
  type Paint,
  type GradientPaint,
} from '@weasel-js/core';
import { seedMeshPatch } from '@weasel-js/core/mesh';
import { renderWithIcons } from '../../testing/withIcons';
import { PaintInput } from './PaintInput';

const LINEAR: GradientPaint = {
  kind: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 1, y: 0 },
  stops: [
    { offset: 0, color: '#ff0000ff' },
    { offset: 1, color: '#0000ffff' },
  ],
  units: 'bounds',
};

const SOLID: Paint = { kind: 'solid', color: '#336699ff' };

/** A controlled host, so a kind switch feeds its own next render the way a
 *  panel does — the switch memory is only reachable across renders. */
function Host(props: { initial: Paint; onCommit?: (next: Paint | null) => void }) {
  const [value, setValue] = useState<Paint | null>(props.initial);
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
    renderWithIcons(<PaintInput value={SOLID} onChange={() => {}} />);
    for (const label of ['Solid', 'Linear', 'Radial', 'Conic', 'Pattern']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
  });

  it('restricts the bar to `kinds` when given', () => {
    renderWithIcons(<PaintInput value={SOLID} kinds={['solid', 'linear-gradient']} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Solid' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Pattern' })).toBeNull();
  });

  it('lights the active kind, and nothing when mixed', () => {
    const { rerender } = renderWithIcons(<PaintInput value={LINEAR} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Linear' })).toBeChecked();

    rerender(<PaintInput value={LINEAR} mixed onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Linear' })).not.toBeChecked();
  });

  it('shows a gradient as a gradient rather than an indeterminate chip', () => {
    const { container } = renderWithIcons(<PaintInput value={LINEAR} onChange={() => {}} />);
    expect(screen.getByLabelText('Stop 1')).toBeInTheDocument();
    expect(container.querySelector('[data-mixed]')).toBeNull();
  });

  it('still shows the indeterminate chip when the selection is mixed', () => {
    const { container } = renderWithIcons(<PaintInput value={LINEAR} mixed onChange={() => {}} />);
    expect(container.querySelector('[data-mixed]')).not.toBeNull();
  });

  // The switch precedence, which is the whole point of the memory.
  it('linear -> solid -> linear restores the stops', () => {
    const onCommit = vi.fn();
    renderWithIcons(<Host initial={LINEAR} onCommit={onCommit} />);

    clickKind('Solid');
    expect(onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ color: '#ff0000ff' }));

    clickKind('Linear');
    expect(onCommit).toHaveBeenLastCalledWith(LINEAR);
  });

  it('forgets the last subject\'s paints when pointed at another', () => {
    const onChange = vi.fn();
    const { rerender } = renderWithIcons(<PaintInput subject="a" value={LINEAR} onChange={onChange} />);
    rerender(<PaintInput subject="b" value={SOLID} onChange={onChange} />);

    clickKind('Linear');
    const next = onChange.mock.calls.at(-1)?.[0] as GradientPaint;
    expect(next.kind).toBe('linear-gradient');
    expect(next.stops[0].color).toBe('#336699ff');
  });

  it('keeps its memory while the subject stays the same', () => {
    const onChange = vi.fn();
    const { rerender } = renderWithIcons(<PaintInput subject="a" value={LINEAR} onChange={onChange} />);
    rerender(<PaintInput subject="a" value={SOLID} onChange={onChange} />);

    clickKind('Linear');
    expect(onChange).toHaveBeenLastCalledWith(LINEAR);
  });

  it('seeds a kind it has not seen instead of remembering one', () => {
    const onCommit = vi.fn();
    renderWithIcons(<Host initial={SOLID} onCommit={onCommit} />);

    clickKind('Pattern');
    const next = onCommit.mock.calls.at(-1)?.[0] as Paint;
    expect(next).toMatchObject({ kind: 'hatch', color: '#336699ff' });
  });

  it('offers every tile kind under one Pattern segment', () => {
    renderWithIcons(<Host initial={SOLID} />);
    const bar = screen.getByRole('radiogroup', { name: 'Paint kind' });
    expect(within(bar).queryByRole('radio', { name: 'Hatch' })).toBeNull();
    expect(within(bar).getAllByRole('radio', { name: 'Pattern' })).toHaveLength(1);
  });

  it('keeps the Pattern segment lit as the picker moves between tile kinds', () => {
    const onCommit = vi.fn();
    renderWithIcons(<Host initial={{ kind: 'hatch', color: '#336699', units: 'bounds' }} onCommit={onCommit} />);
    const pattern = (): HTMLElement => screen.getByRole('radio', { name: 'Pattern' });
    expect(pattern()).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'dots' }));
    expect(onCommit.mock.calls.at(-1)?.[0]).toMatchObject({ kind: 'dots' });
    expect(pattern()).toBeChecked();
  });

  it('carries gradient geometry across a gradient-to-gradient switch', () => {
    const onCommit = vi.fn();
    renderWithIcons(<Host initial={LINEAR} onCommit={onCommit} />);

    clickKind('Radial');
    const next = onCommit.mock.calls.at(-1)?.[0] as GradientPaint;
    expect(next.kind).toBe('radial-gradient');
    expect(next.stops).toEqual(LINEAR.stops);
  });

  it("carries a gradient's colors into a mesh rather than seeding one", () => {
    const onCommit = vi.fn();
    renderWithIcons(<Host initial={LINEAR} onCommit={onCommit} />);

    clickKind('Mesh');
    const next = onCommit.mock.calls.at(-1)?.[0] as unknown as { kind: string; patches: { colors: string[] }[] };
    expect(next.kind).toBe('mesh-gradient');
    expect(next.patches[0].colors).toEqual(['#ff0000ff', '#0000ffff', '#0000ffff', '#ff0000ff']);
  });

  it('prefers the memory over a gradient-to-gradient conversion', () => {
    // Radial carries no angle, so conic -> radial -> conic is the round trip
    // a conversion cannot survive. The memory is what restores the angle.
    const CONIC: GradientPaint = {
      kind: 'conic-gradient',
      center: { x: 0.5, y: 0.5 },
      angle: 1.2,
      stops: LINEAR.stops,
      units: 'bounds',
    };
    const onCommit = vi.fn();
    renderWithIcons(<Host initial={CONIC} onCommit={onCommit} />);

    clickKind('Radial');
    clickKind('Conic');
    const back = onCommit.mock.calls.at(-1)?.[0] as GradientPaint;
    expect(back.kind).toBe('conic-gradient');
    // Converting radial -> conic would have flattened this to 0.
    expect((back as Extract<GradientPaint, { kind: 'conic-gradient' }>).angle).toBe(1.2);
  });

  it('offers None, and switching to it commits no paint at all', () => {
    const onCommit = vi.fn();
    renderWithIcons(<Host initial={SOLID} onCommit={onCommit} />);

    clickKind('None');
    expect(onCommit).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('radio', { name: 'None' })).toBeChecked();
  });

  it('draws None as a glyph, like every other segment', () => {
    renderWithIcons(<PaintInput value={null} onChange={() => {}} />);
    const none = screen.getByRole('radio', { name: 'None' });
    expect(none).toHaveAttribute('aria-label', 'None');
    expect(none.querySelector('svg')).not.toBeNull();
  });

  it('draws Inherit as a glyph, keeping its name for the accessible label', () => {
    renderWithIcons(<PaintInput value="inherit" inherit={{ paint: null, onInherit: () => {} }} onChange={() => {}} />);
    const inherit = screen.getByRole('radio', { name: 'Inherit' });
    expect(inherit).toHaveAttribute('aria-label', 'Inherit');
    expect(inherit.querySelector('svg')).not.toBeNull();
  });

  it('shows no editor body for None', () => {
    renderWithIcons(<PaintInput value={null} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'None' })).toBeChecked();
    expect(document.querySelector('input[type="color"]')).toBeNull();
  });

  it('leaving None restores the paint it was remembered from', () => {
    const onCommit = vi.fn();
    renderWithIcons(<Host initial={LINEAR} onCommit={onCommit} />);

    clickKind('None');
    expect(onCommit).toHaveBeenLastCalledWith(null);

    clickKind('Linear');
    // None carries nothing, so the memory has to survive the trip through it.
    expect(onCommit).toHaveBeenLastCalledWith(LINEAR);
  });

  it('omits None when allowNone is false', () => {
    renderWithIcons(<PaintInput value={SOLID} allowNone={false} onChange={() => {}} />);
    expect(screen.queryByRole('radio', { name: 'None' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Solid' })).toBeInTheDocument();
  });
});

describe('PaintInput — a registered kind', () => {
  const disposers: (() => void)[] = [];
  afterEach(() => {
    // Unmount before disposing, or the removal re-renders a mounted input outside act.
    cleanup();
    while (disposers.length) disposers.pop()?.();
  });

  it('appears in the bar and renders its own editor', () => {
    disposers.push(registerPaintKind({
      id: 'noise',
      label: 'Noise',
      seed: (color) => asPaint({ kind: 'noise', color }),
      colorOf: (paint) => (paint as unknown as { color?: string }).color,
      Editor: () => <div data-testid="noise-editor" />,
    }));

    renderWithIcons(<PaintInput value={asPaint({ kind: 'noise', color: '#112233ff' })} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Noise' })).toBeInTheDocument();
    expect(screen.getByTestId('noise-editor')).toBeInTheDocument();
  });

  it('picks up a kind registered after it mounted', () => {
    renderWithIcons(<PaintInput value={asPaint({ kind: 'noise', color: '#112233ff' })} onChange={() => {}} />);
    expect(screen.queryByRole('radio', { name: 'Noise' })).toBeNull();

    act(() => {
      disposers.push(registerPaintKind({
        id: 'noise',
        label: 'Noise',
        seed: (color) => asPaint({ kind: 'noise', color }),
        colorOf: (paint) => (paint as unknown as { color?: string }).color,
        Editor: () => <div data-testid="noise-editor" />,
      }));
    });
    expect(screen.getByRole('radio', { name: 'Noise' })).toBeInTheDocument();
    expect(screen.getByTestId('noise-editor')).toBeInTheDocument();
  });

  it('an entry Editor overrides the built-in body for a built-in id', () => {
    disposers.push(registerPaintKind({
      id: 'linear-gradient',
      label: 'Linear',
      seed: () => LINEAR,
      colorOf: (paint) => (paint as GradientPaint).stops?.[0]?.color,
      Editor: () => <div data-testid="custom-linear" />,
    }));

    renderWithIcons(<PaintInput value={LINEAR} onChange={() => {}} />);
    expect(screen.getByTestId('custom-linear')).toBeInTheDocument();
    expect(screen.queryByLabelText('Stop 1')).toBeNull();
  });

  it('refuses to edit a kind it has no editor for rather than flattening it to a solid', () => {
    disposers.push(registerPaintKind({
      id: 'noise',
      label: 'Noise',
      seed: (color) => asPaint({ kind: 'noise', color }),
      colorOf: (paint) => (paint as unknown as { color?: string }).color,
    }));
    const onChange = vi.fn();
    const onInput = vi.fn();
    const { container } = renderWithIcons(
      <PaintInput
        value={asPaint({ kind: 'noise', color: '#112233ff' })}
        onInput={onInput}
        onChange={onChange}
      />,
    );

    const body = container.querySelector('[role="radiogroup"]')?.nextElementSibling;
    for (const input of container.querySelectorAll('input:not([type="radio"])')) {
      fireEvent.input(input, { target: { value: '#ff0000' } });
      fireEvent.change(input, { target: { value: '#ff0000' } });
    }
    if (body) fireEvent.click(body);
    expect(onInput).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(body).toHaveTextContent('Noise');
  });
});

describe('PaintInput — solid opacity', () => {
  const opacitySlider = (): HTMLInputElement =>
    screen.getByRole('slider', { name: /opacity/i }) as HTMLInputElement;

  it("reads a solid paint's alpha from its opacity slot", () => {
    renderWithIcons(<PaintInput value={{ color: '#336699', opacity: 0.4 }} onChange={() => {}} />);
    expect(opacitySlider().value).toBe('40');
  });

  it('follows an opacity written from outside the control', () => {
    const { rerender } = renderWithIcons(<PaintInput value={{ color: '#336699' }} onChange={() => {}} />);
    expect(opacitySlider().value).toBe('100');
    rerender(<PaintInput value={{ color: '#336699', opacity: 0.25 }} onChange={() => {}} />);
    expect(opacitySlider().value).toBe('25');
  });

  it('commits alpha into the opacity slot, not the hex', () => {
    const onChange = vi.fn();
    renderWithIcons(<PaintInput value={{ color: '#336699', opacity: 0.4 }} onChange={onChange} />);
    fireEvent.input(opacitySlider(), { target: { value: '70' } });
    fireEvent.pointerUp(opacitySlider());
    expect(onChange).toHaveBeenLastCalledWith({ color: '#336699', opacity: 0.7 });
  });
});

describe('PaintInput — opacity of a paint with no single color', () => {
  const PATTERN: Paint = {
    kind: 'hatch', color: '#336699', size: 8,
    units: 'bounds',
  };
  const MESH: Paint = asPaint(seedMeshPatch('#ff0000ff'));

  // Exact name: a gradient's stop swatches carry opacity sliders of their own.
  const opacitySlider = (): HTMLInputElement =>
    screen.getByRole('slider', { name: 'Opacity' }) as HTMLInputElement;

  for (const [name, paint] of [['gradient', LINEAR], ['pattern', PATTERN], ['mesh', MESH]] as const) {
    it(`writes a ${name}'s opacity slot, keeping the rest of the paint`, () => {
      const onInput = vi.fn();
      const onChange = vi.fn();
      renderWithIcons(<PaintInput value={paint} onInput={onInput} onChange={onChange} />);
      fireEvent.input(opacitySlider(), { target: { value: '30' } });
      expect(onInput).toHaveBeenLastCalledWith({ ...paint, opacity: 0.3 });
      fireEvent.pointerUp(opacitySlider());
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith({ ...paint, opacity: 0.3 });
    });

    it(`follows a ${name}'s opacity written from outside the control`, () => {
      const { rerender } = renderWithIcons(<PaintInput value={paint} onChange={() => {}} />);
      expect(opacitySlider().value).toBe('100');
      rerender(<PaintInput value={{ ...paint, opacity: 0.25 }} onChange={() => {}} />);
      expect(opacitySlider().value).toBe('25');
    });
  }

  it('shows one opacity control for a solid, not a second beside the swatch', () => {
    renderWithIcons(<PaintInput value={SOLID} onChange={() => {}} />);
    expect(screen.getAllByRole('slider', { name: /opacity/i })).toHaveLength(1);
  });
});
