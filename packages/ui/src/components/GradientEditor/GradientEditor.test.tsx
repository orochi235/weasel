import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  asPaint,
  registerPaintKind,
  type FillStyle,
  type GradStop,
  type GradientFill,
} from '@weasel-js/core';
import { seedMeshPatch, type MeshGradientFill } from '@weasel-js/core/mesh';
import { GradientEditor } from './GradientEditor';

const LINEAR: GradientFill = {
  fill: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 100, y: 0 },
  stops: [
    { offset: 0, color: '#ff0000ff' },
    { offset: 1, color: '#0000ffff' },
  ],
  units: 'local',
};

describe('GradientEditor', () => {
  it('renders one color swatch per stop', () => {
    render(<GradientEditor value={LINEAR} onChange={() => {}} />);
    expect(screen.getByLabelText('Stop 1 at 0%')).toBeInTheDocument();
    expect(screen.getByLabelText('Stop 2 at 100%')).toBeInTheDocument();
  });

  it('recoloring a stop commits the whole gradient, geometry intact', () => {
    const onChange = vi.fn();
    render(<GradientEditor value={LINEAR} onChange={onChange} />);
    const swatch = screen.getByLabelText('Stop 1 at 0%');
    fireEvent.input(swatch, { target: { value: '#00ff00' } });
    fireEvent.blur(swatch);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({
      fill: 'linear-gradient',
      from: { x: 0, y: 0 },
      to: { x: 100, y: 0 },
      units: 'local',
      stops: [
        { offset: 0, color: '#00ff00ff' },
        { offset: 1, color: '#0000ffff' },
      ],
    });
  });

  it('previews a recolor through onInput without committing it', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<GradientEditor value={LINEAR} onInput={onInput} onChange={onChange} />);
    fireEvent.input(screen.getByLabelText('Stop 1 at 0%'), { target: { value: '#00ff00' } });

    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('switching kind preserves stops, units and opacity', () => {
    const onChange = vi.fn();
    render(<GradientEditor value={{ ...LINEAR, opacity: 0.4 }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Radial' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({
      fill: 'radial-gradient',
      center: { x: 50, y: 0 },
      radius: 50,
      units: 'local',
      opacity: 0.4,
      stops: LINEAR.stops,
    });
  });

  it('hides the kind switch when the surrounding UI owns it', () => {
    render(<GradientEditor value={LINEAR} onChange={() => {}} kindSwitch={false} />);
    expect(screen.queryByRole('radio', { name: 'Radial' })).not.toBeInTheDocument();
  });

  it('addresses stops by array position, so an out-of-order list recolors the right one', () => {
    const onChange = vi.fn();
    const unordered: GradientFill = {
      ...LINEAR,
      stops: [
        { offset: 1, color: '#0000ffff' },
        { offset: 0, color: '#ff0000ff' },
      ],
    };
    render(<GradientEditor value={unordered} onChange={onChange} />);
    // The row is sorted for display, so the leftmost swatch is stops[1].
    const swatch = screen.getByLabelText('Stop 2 at 0%');
    fireEvent.input(swatch, { target: { value: '#00ff00' } });
    fireEvent.blur(swatch);

    expect(onChange.mock.calls[0][0].stops).toEqual([
      { offset: 1, color: '#0000ffff' },
      { offset: 0, color: '#00ff00ff' },
    ]);
  });

  describe('the interpolation space', () => {
    it('commits the space the reader picked, geometry and stops intact', () => {
      const onChange = vi.fn();
      render(<GradientEditor value={LINEAR} onChange={onChange} />);
      fireEvent.click(screen.getByRole('radio', { name: 'OKLCh' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toMatchObject({
        fill: 'linear-gradient',
        from: { x: 0, y: 0 },
        to: { x: 100, y: 0 },
        units: 'local',
        interpolate: 'oklch',
        stops: LINEAR.stops,
      });
    });

    it('shows sRGB as the state of a gradient that named no space', () => {
      render(<GradientEditor value={LINEAR} onChange={() => {}} />);
      expect(screen.getByRole('radio', { name: 'sRGB' })).toBeChecked();
    });

    it('hides the switch when the surrounding UI owns it', () => {
      render(<GradientEditor value={LINEAR} onChange={() => {}} spaceSwitch={false} />);
      expect(screen.queryByRole('radio', { name: 'OKLCh' })).not.toBeInTheDocument();
    });

  });

  describe('kinds', () => {
    const kindNames = () =>
      within(screen.getByRole('radiogroup', { name: 'Gradient kind' }))
        .getAllByRole('radio')
        .map((r) => r.getAttribute('aria-label') ?? r.textContent);

    it('offers every registered gradient kind, mesh included', () => {
      render(<GradientEditor value={LINEAR} onChange={() => {}} />);
      expect(kindNames()).toEqual(['Linear', 'Radial', 'Conic', 'Mesh']);
    });

    it('offers a kind a consumer registers with a stop reading', () => {
      const dispose = registerPaintKind({
        id: 'diamond-gradient',
        label: 'Diamond',
        seed: (color) => asPaint({ fill: 'diamond-gradient', stops: [{ offset: 0, color }] }),
        colorOf: () => undefined,
        stopsOf: (paint) => (paint as unknown as { stops: GradStop[] }).stops,
        fromStops: (stops) => asPaint({ fill: 'diamond-gradient', stops }),
      });
      try {
        render(<GradientEditor value={LINEAR} onChange={() => {}} />);
        expect(kindNames()).toContain('Diamond');
      } finally {
        dispose();
      }
    });

    it('switches a stop gradient to a mesh carrying its colors', () => {
      const onChange = vi.fn();
      render(<GradientEditor value={LINEAR} onChange={onChange} />);
      fireEvent.click(screen.getByRole('radio', { name: 'Mesh' }));
      const next = onChange.mock.calls[0][0] as MeshGradientFill;
      expect(next.fill).toBe('mesh-gradient');
      expect(next.patches[0].colors).toEqual(['#ff0000ff', '#0000ffff', '#0000ffff', '#ff0000ff']);
    });

    it('edits a mesh by its corners, and switches it back to a stop gradient', () => {
      const onChange = vi.fn();
      const mesh = seedMeshPatch('#ff0000ff') as unknown as FillStyle;
      render(<GradientEditor value={mesh} onChange={onChange} />);
      expect(screen.getByLabelText('Patch 1 corner 1')).toBeInTheDocument();
      expect(screen.queryByRole('slider', { name: /Gradient stops/ })).toBeNull();
      expect(screen.getByRole('radio', { name: 'Mesh' })).toBeChecked();

      fireEvent.click(screen.getByRole('radio', { name: 'Linear' }));
      expect(onChange.mock.calls[0][0]).toMatchObject({ fill: 'linear-gradient', stops: [{ offset: 0, color: '#ff0000ff' }, { offset: 1 }] });
    });
  });

  describe('svg', () => {
    const radios = (group: string) =>
      within(screen.getByRole('radiogroup', { name: group })).getAllByRole('radio').map((r) => r.textContent);

    it('is off by default', () => {
      render(<GradientEditor value={LINEAR} onChange={() => {}} />);
      expect(radios('Gradient kind')).toContain('Conic');
      expect(radios('Blend space')).toEqual(['sRGB', 'OKLab', 'OKLCh']);
    });

    it('limits the kinds to the gradients SVG has elements for, and drops the space switch', () => {
      render(<GradientEditor value={LINEAR} svg onChange={() => {}} />);
      expect(radios('Gradient kind')).toEqual(['Linear', 'Radial']);
      expect(screen.queryByRole('radiogroup', { name: 'Blend space' })).toBeNull();
    });

    it('still shows the kind and space a value already has, so it can be switched off them', () => {
      const conic: GradientFill = { fill: 'conic-gradient', center: { x: 0, y: 0 }, angle: 0, stops: LINEAR.stops, interpolate: 'oklch' };
      render(<GradientEditor value={conic} svg onChange={() => {}} />);
      expect(radios('Gradient kind')).toEqual(['Linear', 'Radial', 'Conic']);
      expect(radios('Blend space')).toEqual(['sRGB', 'OKLCh']);
    });
  });
});
