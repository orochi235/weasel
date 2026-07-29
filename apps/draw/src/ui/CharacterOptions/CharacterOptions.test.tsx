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

  it('offers all four run flags', () => {
    render(<CharacterOptions style={{}} onPatch={vi.fn()} />);
    for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough']) {
      expect(toggle(name)).toHaveAttribute('aria-pressed', 'false');
    }
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
