import { describe, expect, it, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { MIXED } from '@weasel-js/core';
import { CharacterOptions, isCharacterChrome } from './CharacterOptions';
import { renderWithIcons } from '../../testing/withIcons';

function toggle(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

describe('CharacterOptions — flag toggles', () => {
  it('turns a flag on', () => {
    const onPatch = vi.fn();
    renderWithIcons(<CharacterOptions style={{ bold: false }} onPatch={onPatch} />);
    fireEvent.click(toggle('Bold'));
    expect(onPatch).toHaveBeenCalledWith({ bold: true });
  });

  it('turns a flag off', () => {
    const onPatch = vi.fn();
    renderWithIcons(<CharacterOptions style={{ bold: true }} onPatch={onPatch} />);
    fireEvent.click(toggle('Bold'));
    expect(onPatch).toHaveBeenCalledWith({ bold: false });
  });

  it('patches only the flag that changed', () => {
    const onPatch = vi.fn();
    renderWithIcons(
      <CharacterOptions
        style={{ bold: true, italic: true, underline: true }}
        onPatch={onPatch}
      />,
    );
    fireEvent.click(toggle('Italic'));
    expect(onPatch).toHaveBeenCalledWith({ italic: false });
  });

  it('renders a mixed flag as indeterminate', () => {
    renderWithIcons(<CharacterOptions style={{ bold: MIXED }} onPatch={vi.fn()} />);
    expect(toggle('Bold')).toHaveAttribute('aria-pressed', 'mixed');
  });

  it('turns a mixed flag fully on', () => {
    const onPatch = vi.fn();
    renderWithIcons(<CharacterOptions style={{ bold: MIXED }} onPatch={onPatch} />);
    fireEvent.click(toggle('Bold'));
    expect(onPatch).toHaveBeenCalledWith({ bold: true });
  });

  it('offers all five run flags', () => {
    renderWithIcons(<CharacterOptions style={{}} onPatch={vi.fn()} />);
    for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Overline']) {
      expect(toggle(name)).toHaveAttribute('aria-pressed', 'false');
    }
  });
});

describe('CharacterOptions — weight', () => {
  it('shows the weight and patches a picked one', () => {
    const onPatch = vi.fn();
    renderWithIcons(<CharacterOptions style={{ fontWeight: 400 }} onPatch={onPatch} />);
    const weight = screen.getByRole('button', { name: /Weight/ });
    expect(weight).toHaveTextContent('400 Regular');
    fireEvent.click(weight);
    fireEvent.click(screen.getByRole('option', { name: '300 Light' }));
    expect(onPatch).toHaveBeenCalledWith({ fontWeight: 300 });
  });

  it('draws a mixed weight as Mixed', () => {
    renderWithIcons(<CharacterOptions style={{ fontWeight: MIXED }} onPatch={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Weight/ })).toHaveTextContent('Mixed');
  });
});

describe('CharacterOptions — script', () => {
  it('sets superscript', () => {
    const onPatch = vi.fn();
    renderWithIcons(<CharacterOptions style={{}} onPatch={onPatch} />);
    fireEvent.click(toggle('Superscript'));
    expect(onPatch).toHaveBeenCalledWith({ script: 'super' });
  });

  it('clears by clicking the lit segment — off is the enum\'s absence', () => {
    const onPatch = vi.fn();
    renderWithIcons(<CharacterOptions style={{ script: 'super' }} onPatch={onPatch} />);
    fireEvent.click(toggle('Superscript'));
    expect(onPatch).toHaveBeenCalledWith({ script: undefined });
  });

  it('swaps rather than stacking — the two are mutually exclusive', () => {
    const onPatch = vi.fn();
    renderWithIcons(<CharacterOptions style={{ script: 'super' }} onPatch={onPatch} />);
    fireEvent.click(toggle('Subscript'));
    expect(onPatch).toHaveBeenCalledWith({ script: 'sub' });
  });

  it('renders a mixed script as indeterminate on both segments', () => {
    renderWithIcons(<CharacterOptions style={{ script: MIXED }} onPatch={vi.fn()} />);
    expect(toggle('Superscript')).toHaveAttribute('aria-pressed', 'mixed');
    expect(toggle('Subscript')).toHaveAttribute('aria-pressed', 'mixed');
  });

  it('does not light a script segment for an unset script', () => {
    renderWithIcons(<CharacterOptions style={{}} onPatch={vi.fn()} />);
    expect(toggle('Superscript')).toHaveAttribute('aria-pressed', 'false');
    expect(toggle('Subscript')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('CharacterOptions — script primitives', () => {
  it('shows the two fractions as percentages', () => {
    renderWithIcons(
      <CharacterOptions style={{ baselineShift: 0.333, fontScale: 0.583 }} onPatch={vi.fn()} />,
    );
    // The unit's suffix is drawn beside the field rather than inside its
    // value, so a typed number needs no punctuation stripped back off.
    expect(screen.getByRole('spinbutton', { name: 'Baseline shift' })).toHaveValue('33.3');
    expect(screen.getByRole('spinbutton', { name: 'Scale' })).toHaveValue('58.3');
    expect(screen.getAllByText('%')).toHaveLength(2);
  });

  it('commits a percentage back as the fraction the run stores', () => {
    const onPatch = vi.fn();
    renderWithIcons(<CharacterOptions style={{ fontScale: 1 }} onPatch={onPatch} />);
    const input = screen.getByRole('spinbutton', { name: 'Scale' });
    fireEvent.change(input, { target: { value: '50%' } });
    fireEvent.blur(input);
    expect(onPatch).toHaveBeenCalledWith({ fontScale: 0.5 });
  });

  it('takes a negative baseline shift — that is what a subscript is', () => {
    const onPatch = vi.fn();
    renderWithIcons(<CharacterOptions style={{ baselineShift: 0 }} onPatch={onPatch} />);
    const input = screen.getByRole('spinbutton', { name: 'Baseline shift' });
    fireEvent.change(input, { target: { value: '-33.3%' } });
    fireEvent.blur(input);
    expect(onPatch).toHaveBeenCalledWith({ baselineShift: -0.333 });
  });
});

describe('CharacterOptions — numeric fields', () => {
  it('shows the shared font size', () => {
    renderWithIcons(<CharacterOptions style={{ fontSize: 18 }} onPatch={vi.fn()} />);
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toHaveValue('18');
  });

  it('shows a mixed font size as an empty Mixed placeholder', () => {
    renderWithIcons(<CharacterOptions style={{ fontSize: MIXED }} onPatch={vi.fn()} />);
    const input = screen.getByRole('spinbutton', { name: 'Size' });
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', 'Mixed');
  });

  it('commits a font size on blur', () => {
    const onPatch = vi.fn();
    renderWithIcons(<CharacterOptions style={{ fontSize: 18 }} onPatch={onPatch} />);
    const input = screen.getByRole('spinbutton', { name: 'Size' });
    fireEvent.change(input, { target: { value: '24' } });
    fireEvent.blur(input);
    expect(onPatch).toHaveBeenCalledWith({ fontSize: 24 });
  });

  it('commits tracking on blur', () => {
    const onPatch = vi.fn();
    renderWithIcons(<CharacterOptions style={{ letterSpacing: 0 }} onPatch={onPatch} />);
    const input = screen.getByRole('spinbutton', { name: 'Tracking' });
    fireEvent.change(input, { target: { value: '1.5' } });
    fireEvent.blur(input);
    expect(onPatch).toHaveBeenCalledWith({ letterSpacing: 1.5 });
  });
});

describe('CharacterOptions — fill', () => {
  it('shows a solid fill color', () => {
    renderWithIcons(
      <CharacterOptions style={{ fill: { paint: { color: '#ff0000ff' } } }} onPatch={vi.fn()} />,
    );
    expect(screen.getByLabelText('Color')).toHaveValue('#ff0000');
  });

  it('patches a solid fill', () => {
    const onPatch = vi.fn();
    renderWithIcons(
      <CharacterOptions style={{ fill: { paint: { color: '#ff0000ff' } } }} onPatch={onPatch} />,
    );
    const input = screen.getByLabelText('Color');
    fireEvent.input(input, { target: { value: '#00ff00' } });
    fireEvent.blur(input);
    expect(onPatch).toHaveBeenCalledWith({ fill: { paint: { color: '#00ff00ff' } } });
  });

  it('treats a non-solid fill as indeterminate rather than inventing a swatch', () => {
    // A gradient has no single color to show. Rendering a solid swatch would
    // claim the text is that color, and `ColorField`'s own mixed handling —
    // no committed value until the first real edit — is exactly right here.
    const { container } = renderWithIcons(
      <CharacterOptions
        style={{
          fill: {
            paint: {
              kind: 'linear-gradient',
              from: { x: 0, y: 0 },
              to: { x: 1, y: 0 },
              stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
            },
          },
        }}
        onPatch={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-mixed]')).not.toBeNull();
  });

  it('treats a mixed fill as indeterminate', () => {
    const { container } = renderWithIcons(
      <CharacterOptions style={{ fill: MIXED }} onPatch={vi.fn()} />,
    );
    expect(container.querySelector('[data-mixed]')).not.toBeNull();
  });
});

describe('CharacterOptions — no fill', () => {
  it('lights the chip for a range with no fill, and for an unfilled node', () => {
    const { rerender, container } = renderWithIcons(<CharacterOptions style={{ fill: null }} onPatch={vi.fn()} />);
    expect(toggle('No fill')).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('[data-mixed]')).toBeNull();
    // `effectiveRangeStyle` leaves `fill` off an unfilled node's range.
    rerender(<CharacterOptions style={{ bold: false }} onPatch={vi.fn()} />);
    expect(toggle('No fill')).toHaveAttribute('aria-pressed', 'true');
  });

  it('lights it, unmixed, for a fill that carries no paint', () => {
    const { container } = renderWithIcons(<CharacterOptions style={{ fill: {} }} onPatch={vi.fn()} />);
    expect(toggle('No fill')).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('[data-mixed]')).toBeNull();
  });

  it('leaves it unlit over a filled range, a mixed one included', () => {
    const { rerender } = renderWithIcons(<CharacterOptions style={{ fill: { paint: { color: '#ff0000ff' } } }} onPatch={vi.fn()} />);
    expect(toggle('No fill')).toHaveAttribute('aria-pressed', 'false');
    rerender(<CharacterOptions style={{ fill: MIXED }} onPatch={vi.fn()} />);
    expect(toggle('No fill')).toHaveAttribute('aria-pressed', 'false');
  });

  it('unfills the range', () => {
    const onPatch = vi.fn();
    renderWithIcons(<CharacterOptions style={{ fill: { paint: { color: '#ff0000ff' } } }} onPatch={onPatch} />);
    fireEvent.click(toggle('No fill'));
    expect(onPatch).toHaveBeenCalledWith({ fill: null });
  });

  it('fills an unfilled range with the color the field shows', () => {
    const onPatch = vi.fn();
    renderWithIcons(<CharacterOptions style={{ fill: null }} onPatch={onPatch} />);
    expect(screen.getByLabelText('Color')).toHaveValue('#000000');
    fireEvent.click(toggle('No fill'));
    expect(onPatch).toHaveBeenCalledWith({ fill: { paint: { color: '#000000' } } });
  });
});

describe('CharacterOptions — idle', () => {
  it('draws no controls for a null style, the value useTextEdit reports outside an edit', () => {
    renderWithIcons(<CharacterOptions style={null} onPatch={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Text')).toBeNull();
  });
});

describe('isCharacterChrome', () => {
  it('claims a control in the bar and a kit popover, and nothing else', () => {
    renderWithIcons(
      <>
        <CharacterOptions style={{ bold: false }} onPatch={vi.fn()} />
        <div data-weasel-overlay=""><span data-testid="option" /></div>
        <span data-testid="elsewhere" />
      </>,
    );
    expect(isCharacterChrome(toggle('Bold'))).toBe(true);
    expect(isCharacterChrome(screen.getByTestId('option'))).toBe(true);
    expect(isCharacterChrome(screen.getByTestId('elsewhere'))).toBe(false);
  });
});
