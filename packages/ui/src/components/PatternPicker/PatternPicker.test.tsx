import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { composePatternTransform, decomposePatternTransform } from '@weasel-js/core';
import type { PatternPaint as PatternFill } from '@weasel-js/core';
import { PatternPicker, seedImagePattern, seedPattern } from './PatternPicker';

function rotationInput(): HTMLInputElement {
  return screen.getByRole('spinbutton', { name: 'Rotation' }) as HTMLInputElement;
}

function commit(value: string): void {
  const input = rotationInput();
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe('PatternPicker rotation', () => {
  it('shows an untransformed pattern at 0°', () => {
    render(<PatternPicker value={seedPattern('hatch', '#123456')} color="#123456" onChange={() => {}} />);
    expect(rotationInput().value).toMatch(/^0/);
  });

  it('shows the rotation a transform carries, in degrees', () => {
    const value: PatternFill = {
      ...seedPattern('hatch', '#123456'),
      transform: composePatternTransform({ rotation: Math.PI / 4, scaleX: 2 }),
    };
    render(<PatternPicker value={value} color="#123456" onChange={() => {}} />);
    expect(rotationInput().value).toMatch(/^45/);
  });

  it('commits a rotation as the paint transform, keeping scale and skew', () => {
    const onChange = vi.fn();
    const value: PatternFill = {
      ...seedPattern('hatch', '#123456'),
      transform: composePatternTransform({ scaleX: 2, skewX: 0.2 }),
    };
    render(<PatternPicker value={value} color="#123456" onChange={onChange} />);
    commit('30');
    const next = onChange.mock.calls[0][0] as PatternFill;
    const parts = decomposePatternTransform(next.transform);
    expect(parts.rotation).toBeCloseTo(Math.PI / 6, 9);
    expect(parts.scaleX).toBeCloseTo(2, 9);
    expect(parts.skewX).toBeCloseTo(0.2, 9);
    expect(next).toMatchObject(seedPattern('hatch', '#123456'));
  });

  it('shows a rotation off the 15° step as it is', () => {
    const value: PatternFill = {
      ...seedPattern('hatch', '#123456'),
      transform: composePatternTransform({ rotation: Math.PI / 8 }),
    };
    render(<PatternPicker value={value} color="#123456" onChange={() => {}} />);
    expect(rotationInput().value).toMatch(/^22\.5/);
  });

  it('commits a typed rotation off the 15° step unchanged', () => {
    const onChange = vi.fn();
    render(<PatternPicker value={seedPattern('hatch', '#123456')} color="#123456" onChange={onChange} />);
    commit('20');
    const next = onChange.mock.calls[0][0] as PatternFill;
    expect(decomposePatternTransform(next.transform).rotation).toBeCloseTo((20 * Math.PI) / 180, 9);
  });

  it('steps the rotation by 15° on an arrow key', () => {
    const onChange = vi.fn();
    const value: PatternFill = {
      ...seedPattern('hatch', '#123456'),
      transform: composePatternTransform({ rotation: Math.PI / 9 }),
    };
    render(<PatternPicker value={value} color="#123456" onChange={onChange} />);
    fireEvent.keyDown(rotationInput(), { key: 'ArrowUp' });
    const next = onChange.mock.calls[0][0] as PatternFill;
    expect(decomposePatternTransform(next.transform).rotation).toBeCloseTo((35 * Math.PI) / 180, 9);
  });

  it('drops the transform when rotation returns to an identity', () => {
    const onChange = vi.fn();
    const value: PatternFill = {
      ...seedPattern('hatch', '#123456'),
      transform: composePatternTransform({ rotation: 1 }),
    };
    render(<PatternPicker value={value} color="#123456" onChange={onChange} />);
    commit('0');
    expect(onChange.mock.calls[0][0]).not.toHaveProperty('transform');
  });

  it('keeps the rotation across a tile pick', () => {
    const onChange = vi.fn();
    const transform = composePatternTransform({ rotation: 0.5 });
    const value: PatternFill = { ...seedPattern('hatch', '#123456'), transform };
    render(<PatternPicker value={value} color="#123456" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'dots' }));
    const next = onChange.mock.calls[0][0] as PatternFill;
    expect(next.kind).toBe('dots');
    expect(next.transform).toEqual(transform);
  });
});

describe('PatternPicker images', () => {
  const READ = { src: 'data:image/png;base64,AAAA', width: 400, height: 200 };

  function upload(): void {
    const input = screen.getByTestId('pattern-image-file') as HTMLInputElement;
    const file = new File(['x'], 'tile.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
  }

  it('commits a picked file as an image paint, its longest side at the default size', async () => {
    const onChange = vi.fn();
    const readImage = vi.fn(async () => READ);
    const transform = composePatternTransform({ rotation: 0.5 });
    render(
      <PatternPicker
        value={{ ...seedPattern('hatch', '#123456'), transform }}
        color="#123456"
        onChange={onChange}
        readImage={readImage}
      />,
    );
    upload();
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(readImage).toHaveBeenCalledWith(expect.objectContaining({ name: 'tile.png' }));
    expect(onChange.mock.calls[0][0]).toEqual({ ...seedImagePattern(READ), transform });
    expect(seedImagePattern(READ)).toMatchObject({ kind: 'image', width: 128, height: 64, units: 'bounds' });
  });

  it('marks the image swatch as the one in use', () => {
    render(<PatternPicker value={seedImagePattern(READ)} color="#123456" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'image' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'hatch' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('resizes an image tile by its longest side, keeping its proportions', () => {
    const onChange = vi.fn();
    render(<PatternPicker value={seedImagePattern(READ)} color="#123456" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'S' }));
    expect(onChange.mock.calls[0][0]).toMatchObject({ kind: 'image', src: READ.src, width: 32, height: 16 });
  });

  it('warns and changes nothing when a file cannot be read', async () => {
    const onChange = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <PatternPicker
        value={seedPattern('hatch', '#123456')}
        color="#123456"
        onChange={onChange}
        readImage={() => Promise.reject(new Error('not an image'))}
      />,
    );
    upload();
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
