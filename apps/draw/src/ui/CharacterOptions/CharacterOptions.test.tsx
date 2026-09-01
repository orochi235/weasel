import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MIXED } from '@weasel-js/core';
import { CharacterOptions } from './CharacterOptions';

function toggle(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

describe('CharacterOptions — flag toggles', () => {
  it('turns a flag on', () => {
    const onPatch = vi.fn();
    render(<CharacterOptions style={{ bold: false }} onPatch={onPatch} />);
    fireEvent.click(toggle('Bold'));
    expect(onPatch).toHaveBeenCalledWith({ bold: true });
  });

  it('turns a flag off', () => {
    const onPatch = vi.fn();
    render(<CharacterOptions style={{ bold: true }} onPatch={onPatch} />);
    fireEvent.click(toggle('Bold'));
    expect(onPatch).toHaveBeenCalledWith({ bold: false });
  });

  it('patches only the flag that changed', () => {
    const onPatch = vi.fn();
    render(
      <CharacterOptions
        style={{ bold: true, italic: true, underline: true }}
        onPatch={onPatch}
      />,
    );
    fireEvent.click(toggle('Italic'));
    expect(onPatch).toHaveBeenCalledWith({ italic: false });
  });

  it('renders a mixed flag as indeterminate', () => {
    render(<CharacterOptions style={{ bold: MIXED }} onPatch={vi.fn()} />);
    expect(toggle('Bold')).toHaveAttribute('aria-pressed', 'mixed');
  });

  it('turns a mixed flag fully on', () => {
    const onPatch = vi.fn();
    render(<CharacterOptions style={{ bold: MIXED }} onPatch={onPatch} />);
    fireEvent.click(toggle('Bold'));
    expect(onPatch).toHaveBeenCalledWith({ bold: true });
  });

  it('offers all five run flags', () => {
    render(<CharacterOptions style={{}} onPatch={vi.fn()} />);
    for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Overline']) {
      expect(toggle(name)).toHaveAttribute('aria-pressed', 'false');
    }
  });
});

describe('CharacterOptions — script', () => {
  it('sets superscript', () => {
    const onPatch = vi.fn();
    render(<CharacterOptions style={{}} onPatch={onPatch} />);
    fireEvent.click(toggle('Superscript'));
    expect(onPatch).toHaveBeenCalledWith({ script: 'super' });
  });

  it('clears by clicking the lit segment — off is the enum\'s absence', () => {
    const onPatch = vi.fn();
    render(<CharacterOptions style={{ script: 'super' }} onPatch={onPatch} />);
    fireEvent.click(toggle('Superscript'));
    expect(onPatch).toHaveBeenCalledWith({ script: undefined });
  });

  it('swaps rather than stacking — the two are mutually exclusive', () => {
    const onPatch = vi.fn();
    render(<CharacterOptions style={{ script: 'super' }} onPatch={onPatch} />);
    fireEvent.click(toggle('Subscript'));
    expect(onPatch).toHaveBeenCalledWith({ script: 'sub' });
  });

  it('renders a mixed script as indeterminate on both segments', () => {
    render(<CharacterOptions style={{ script: MIXED }} onPatch={vi.fn()} />);
    expect(toggle('Superscript')).toHaveAttribute('aria-pressed', 'mixed');
    expect(toggle('Subscript')).toHaveAttribute('aria-pressed', 'mixed');
  });

  it('does not light a script segment for an unset script', () => {
    render(<CharacterOptions style={{}} onPatch={vi.fn()} />);
    expect(toggle('Superscript')).toHaveAttribute('aria-pressed', 'false');
    expect(toggle('Subscript')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('CharacterOptions — script primitives', () => {
  it('shows the two fractions as percentages', () => {
    render(
      <CharacterOptions style={{ baselineShift: 0.333, fontScale: 0.583 }} onPatch={vi.fn()} />,
    );
    expect(screen.getByRole('textbox', { name: 'Baseline shift' })).toHaveValue('33.3%');
    expect(screen.getByRole('textbox', { name: 'Scale' })).toHaveValue('58.3%');
  });

  it('commits a percentage back as the fraction the run stores', () => {
    const onPatch = vi.fn();
    render(<CharacterOptions style={{ fontScale: 1 }} onPatch={onPatch} />);
    const input = screen.getByRole('textbox', { name: 'Scale' });
    fireEvent.change(input, { target: { value: '50%' } });
    fireEvent.blur(input);
    expect(onPatch).toHaveBeenCalledWith({ fontScale: 0.5 });
  });

  it('takes a negative baseline shift — that is what a subscript is', () => {
    const onPatch = vi.fn();
    render(<CharacterOptions style={{ baselineShift: 0 }} onPatch={onPatch} />);
    const input = screen.getByRole('textbox', { name: 'Baseline shift' });
    fireEvent.change(input, { target: { value: '-33.3%' } });
    fireEvent.blur(input);
    expect(onPatch).toHaveBeenCalledWith({ baselineShift: -0.333 });
  });
});

describe('CharacterOptions — numeric fields', () => {
  it('shows the shared font size', () => {
    render(<CharacterOptions style={{ fontSize: 18 }} onPatch={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Size' })).toHaveValue('18');
  });

  it('shows a mixed font size as an empty Mixed placeholder', () => {
    render(<CharacterOptions style={{ fontSize: MIXED }} onPatch={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: 'Size' });
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', 'Mixed');
  });

  it('commits a font size on blur', () => {
    const onPatch = vi.fn();
    render(<CharacterOptions style={{ fontSize: 18 }} onPatch={onPatch} />);
    const input = screen.getByRole('textbox', { name: 'Size' });
    fireEvent.change(input, { target: { value: '24' } });
    fireEvent.blur(input);
    expect(onPatch).toHaveBeenCalledWith({ fontSize: 24 });
  });

  it('commits tracking on blur', () => {
    const onPatch = vi.fn();
    render(<CharacterOptions style={{ letterSpacing: 0 }} onPatch={onPatch} />);
    const input = screen.getByRole('textbox', { name: 'Tracking' });
    fireEvent.change(input, { target: { value: '1.5' } });
    fireEvent.blur(input);
    expect(onPatch).toHaveBeenCalledWith({ letterSpacing: 1.5 });
  });
});

describe('CharacterOptions — fill', () => {
  it('shows a solid fill color', () => {
    render(
      <CharacterOptions style={{ fill: { color: '#ff0000ff' } }} onPatch={vi.fn()} />,
    );
    expect(screen.getByLabelText('Color')).toHaveValue('#ff0000');
  });

  it('patches a solid fill', () => {
    const onPatch = vi.fn();
    render(
      <CharacterOptions style={{ fill: { color: '#ff0000ff' } }} onPatch={onPatch} />,
    );
    const input = screen.getByLabelText('Color');
    fireEvent.input(input, { target: { value: '#00ff00' } });
    fireEvent.blur(input);
    expect(onPatch).toHaveBeenCalledWith({ fill: { color: '#00ff00ff' } });
  });

  it('treats a non-solid fill as indeterminate rather than inventing a swatch', () => {
    // A gradient has no single color to show. Rendering a solid swatch would
    // claim the text is that color, and `ColorField`'s own mixed handling —
    // no committed value until the first real edit — is exactly right here.
    const { container } = render(
      <CharacterOptions
        style={{
          fill: {
            fill: 'linear-gradient',
            from: { x: 0, y: 0 },
            to: { x: 1, y: 0 },
            stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
          },
        }}
        onPatch={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-mixed]')).not.toBeNull();
  });

  it('treats a mixed fill as indeterminate', () => {
    const { container } = render(
      <CharacterOptions style={{ fill: MIXED }} onPatch={vi.fn()} />,
    );
    expect(container.querySelector('[data-mixed]')).not.toBeNull();
  });
});
