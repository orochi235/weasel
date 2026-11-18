import { describe, expect, it, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { MIXED } from '@weasel-js/registry';
import { CharacterOptions, isCharacterChrome } from './CharacterOptions';
import { renderWithIcons } from '../../../testing/withIcons';

function toggle(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

describe('CharacterOptions — flag toggles', () => {
  it('turns a flag on', () => {
    const onChange = vi.fn();
    renderWithIcons(<CharacterOptions value={{ bold: false }} onChange={onChange} />);
    fireEvent.click(toggle('Bold'));
    expect(onChange).toHaveBeenCalledWith({ bold: true });
  });

  it('turns a flag off', () => {
    const onChange = vi.fn();
    renderWithIcons(<CharacterOptions value={{ bold: true }} onChange={onChange} />);
    fireEvent.click(toggle('Bold'));
    expect(onChange).toHaveBeenCalledWith({ bold: false });
  });

  it('patches only the flag that changed', () => {
    const onChange = vi.fn();
    renderWithIcons(
      <CharacterOptions
        value={{ bold: true, italic: true, underline: true }}
        onChange={onChange}
      />,
    );
    fireEvent.click(toggle('Italic'));
    expect(onChange).toHaveBeenCalledWith({ italic: false });
  });

  it('renders a mixed flag as indeterminate', () => {
    renderWithIcons(<CharacterOptions value={{ bold: MIXED }} onChange={vi.fn()} />);
    expect(toggle('Bold')).toHaveAttribute('aria-pressed', 'mixed');
  });

  it('turns a mixed flag fully on', () => {
    const onChange = vi.fn();
    renderWithIcons(<CharacterOptions value={{ bold: MIXED }} onChange={onChange} />);
    fireEvent.click(toggle('Bold'));
    expect(onChange).toHaveBeenCalledWith({ bold: true });
  });

  it('offers all five run flags', () => {
    renderWithIcons(<CharacterOptions value={{}} onChange={vi.fn()} />);
    for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Overline']) {
      expect(toggle(name)).toHaveAttribute('aria-pressed', 'false');
    }
  });
});

describe('CharacterOptions — weight', () => {
  it('shows the weight and patches a picked one', () => {
    const onChange = vi.fn();
    renderWithIcons(<CharacterOptions value={{ fontWeight: 400 }} onChange={onChange} />);
    const weight = screen.getByRole('button', { name: /Weight/ });
    expect(weight).toHaveTextContent('400 Regular');
    fireEvent.click(weight);
    fireEvent.click(screen.getByRole('option', { name: '300 Light' }));
    expect(onChange).toHaveBeenCalledWith({ fontWeight: 300 });
  });

  it('draws a mixed weight as Mixed', () => {
    renderWithIcons(<CharacterOptions value={{ fontWeight: MIXED }} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Weight/ })).toHaveTextContent('Mixed');
  });
});

describe('CharacterOptions — script', () => {
  it('sets superscript', () => {
    const onChange = vi.fn();
    renderWithIcons(<CharacterOptions value={{}} onChange={onChange} />);
    fireEvent.click(toggle('Superscript'));
    expect(onChange).toHaveBeenCalledWith({ script: 'super' });
  });

  it('clears by clicking the lit segment — off is the enum\'s absence', () => {
    const onChange = vi.fn();
    renderWithIcons(<CharacterOptions value={{ script: 'super' }} onChange={onChange} />);
    fireEvent.click(toggle('Superscript'));
    expect(onChange).toHaveBeenCalledWith({ script: undefined });
  });

  it('swaps rather than stacking — the two are mutually exclusive', () => {
    const onChange = vi.fn();
    renderWithIcons(<CharacterOptions value={{ script: 'super' }} onChange={onChange} />);
    fireEvent.click(toggle('Subscript'));
    expect(onChange).toHaveBeenCalledWith({ script: 'sub' });
  });

  it('renders a mixed script as indeterminate on both segments', () => {
    renderWithIcons(<CharacterOptions value={{ script: MIXED }} onChange={vi.fn()} />);
    expect(toggle('Superscript')).toHaveAttribute('aria-pressed', 'mixed');
    expect(toggle('Subscript')).toHaveAttribute('aria-pressed', 'mixed');
  });

  it('does not light a script segment for an unset script', () => {
    renderWithIcons(<CharacterOptions value={{}} onChange={vi.fn()} />);
    expect(toggle('Superscript')).toHaveAttribute('aria-pressed', 'false');
    expect(toggle('Subscript')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('CharacterOptions — script primitives', () => {
  it('shows the two fractions as percentages', () => {
    renderWithIcons(
      <CharacterOptions value={{ baselineShift: 0.333, fontScale: 0.583 }} onChange={vi.fn()} />,
    );
    // The unit's suffix is drawn beside the field rather than inside its
    // value, so a typed number needs no punctuation stripped back off.
    expect(screen.getByRole('spinbutton', { name: 'Baseline shift' })).toHaveValue('33.3');
    expect(screen.getByRole('spinbutton', { name: 'Scale' })).toHaveValue('58.3');
    expect(screen.getAllByText('%')).toHaveLength(2);
  });

  it('commits a percentage back as the fraction the run stores', () => {
    const onChange = vi.fn();
    renderWithIcons(<CharacterOptions value={{ fontScale: 1 }} onChange={onChange} />);
    const input = screen.getByRole('spinbutton', { name: 'Scale' });
    fireEvent.change(input, { target: { value: '50%' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith({ fontScale: 0.5 });
  });

  it('takes a negative baseline shift — that is what a subscript is', () => {
    const onChange = vi.fn();
    renderWithIcons(<CharacterOptions value={{ baselineShift: 0 }} onChange={onChange} />);
    const input = screen.getByRole('spinbutton', { name: 'Baseline shift' });
    fireEvent.change(input, { target: { value: '-33.3%' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith({ baselineShift: -0.333 });
  });
});

describe('CharacterOptions — numeric fields', () => {
  it('shows the shared font size', () => {
    renderWithIcons(<CharacterOptions value={{ fontSize: 18 }} onChange={vi.fn()} />);
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toHaveValue('18');
  });

  it('shows a mixed font size as an empty Mixed placeholder', () => {
    renderWithIcons(<CharacterOptions value={{ fontSize: MIXED }} onChange={vi.fn()} />);
    const input = screen.getByRole('spinbutton', { name: 'Size' });
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', 'Mixed');
  });

  it('commits a font size on blur', () => {
    const onChange = vi.fn();
    renderWithIcons(<CharacterOptions value={{ fontSize: 18 }} onChange={onChange} />);
    const input = screen.getByRole('spinbutton', { name: 'Size' });
    fireEvent.change(input, { target: { value: '24' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith({ fontSize: 24 });
  });

  it('commits tracking on blur', () => {
    const onChange = vi.fn();
    renderWithIcons(<CharacterOptions value={{ letterSpacing: 0 }} onChange={onChange} />);
    const input = screen.getByRole('spinbutton', { name: 'Tracking' });
    fireEvent.change(input, { target: { value: '1.5' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith({ letterSpacing: 1.5 });
  });
});

describe('CharacterOptions — fill', () => {
  it('shows a solid fill color', () => {
    renderWithIcons(
      <CharacterOptions value={{ fill: { paint: { color: '#ff0000ff' } } }} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText('Color')).toHaveValue('#ff0000');
  });

  it('patches a solid fill', () => {
    const onChange = vi.fn();
    renderWithIcons(
      <CharacterOptions value={{ fill: { paint: { color: '#ff0000ff' } } }} onChange={onChange} />,
    );
    const input = screen.getByLabelText('Color');
    fireEvent.input(input, { target: { value: '#00ff00' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith({ fill: { paint: { color: '#00ff00ff' } } });
  });

  it('treats a non-solid fill as indeterminate rather than inventing a swatch', () => {
    // A gradient has no single color to show. Rendering a solid swatch would
    // claim the text is that color, and `ColorField`'s own mixed handling —
    // no committed value until the first real edit — is exactly right here.
    const { container } = renderWithIcons(
      <CharacterOptions
        value={{
          fill: {
            paint: {
              kind: 'linear-gradient',
              from: { x: 0, y: 0 },
              to: { x: 1, y: 0 },
              stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
            },
          },
        }}
        onChange={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-mixed]')).not.toBeNull();
  });

  it('treats a mixed fill as indeterminate', () => {
    const { container } = renderWithIcons(
      <CharacterOptions value={{ fill: MIXED }} onChange={vi.fn()} />,
    );
    expect(container.querySelector('[data-mixed]')).not.toBeNull();
  });
});

describe('CharacterOptions — no fill', () => {
  it('lights the chip for a range with no fill, and for an unfilled node', () => {
    const { rerender, container } = renderWithIcons(<CharacterOptions value={{ fill: null }} onChange={vi.fn()} />);
    expect(toggle('No fill')).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('[data-mixed]')).toBeNull();
    // `effectiveRangeStyle` leaves `fill` off an unfilled node's range.
    rerender(<CharacterOptions value={{ bold: false }} onChange={vi.fn()} />);
    expect(toggle('No fill')).toHaveAttribute('aria-pressed', 'true');
  });

  it('lights it, unmixed, for a fill that carries no paint', () => {
    const { container } = renderWithIcons(<CharacterOptions value={{ fill: {} }} onChange={vi.fn()} />);
    expect(toggle('No fill')).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('[data-mixed]')).toBeNull();
  });

  it('leaves it unlit over a filled range, a mixed one included', () => {
    const { rerender } = renderWithIcons(<CharacterOptions value={{ fill: { paint: { color: '#ff0000ff' } } }} onChange={vi.fn()} />);
    expect(toggle('No fill')).toHaveAttribute('aria-pressed', 'false');
    rerender(<CharacterOptions value={{ fill: MIXED }} onChange={vi.fn()} />);
    expect(toggle('No fill')).toHaveAttribute('aria-pressed', 'false');
  });

  it('unfills the range', () => {
    const onChange = vi.fn();
    renderWithIcons(<CharacterOptions value={{ fill: { paint: { color: '#ff0000ff' } } }} onChange={onChange} />);
    fireEvent.click(toggle('No fill'));
    expect(onChange).toHaveBeenCalledWith({ fill: null });
  });

  it('fills an unfilled range with the color the field shows', () => {
    const onChange = vi.fn();
    renderWithIcons(<CharacterOptions value={{ fill: null }} onChange={onChange} />);
    expect(screen.getByLabelText('Color')).toHaveValue('#000000');
    fireEvent.click(toggle('No fill'));
    expect(onChange).toHaveBeenCalledWith({ fill: { paint: { color: '#000000' } } });
  });
});

describe('CharacterOptions — idle', () => {
  it('draws no controls for a null style, the value useTextEdit reports outside an edit', () => {
    renderWithIcons(<CharacterOptions value={null} onChange={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Text')).toBeNull();
  });

  it('renders no bar for a null style, so an app does not show an empty strip', () => {
    renderWithIcons(<CharacterOptions value={null} onChange={vi.fn()} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('keeps the bar for a tenant that is not character styling', () => {
    renderWithIcons(<CharacterOptions value={null} onChange={vi.fn()}><button>Loupe</button></CharacterOptions>);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });
});

describe('isCharacterChrome', () => {
  it('claims a control in the bar and a kit popover, and nothing else', () => {
    renderWithIcons(
      <>
        <CharacterOptions value={{ bold: false }} onChange={vi.fn()} />
        <div data-weasel-overlay=""><span data-testid="option" /></div>
        <span data-testid="elsewhere" />
      </>,
    );
    expect(isCharacterChrome(toggle('Bold'))).toBe(true);
    expect(isCharacterChrome(screen.getByTestId('option'))).toBe(true);
    expect(isCharacterChrome(screen.getByTestId('elsewhere'))).toBe(false);
  });
});
