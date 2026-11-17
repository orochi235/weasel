import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { createRecentColorsStore, RecentColorsProvider } from '../RecentColors';
import { SwatchGrid, type SwatchGridOption } from './SwatchGrid';
import { SwatchButton } from './SwatchButton';

const OPTIONS: SwatchGridOption[] = [
  { value: null, label: 'None' },
  { value: '#ff0000ff', label: 'Red' },
  { value: '#00ff00ff', label: 'Green' },
  { value: '#0000ffff' },
  { value: '#ffff00ff', label: 'Yellow' },
  { value: '#00ffffff', label: 'Cyan' },
];

function mount(over: Partial<Parameters<typeof SwatchGrid>[0]> = {}) {
  const onSelect = vi.fn();
  render(<SwatchGrid options={OPTIONS} onSelect={onSelect} columns={3} aria-label="Colors" {...over} />);
  return { onSelect };
}

describe('SwatchGrid', () => {
  it('names every swatch by label, else by value', () => {
    mount();
    expect(screen.getByRole('group', { name: 'Colors' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Red' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '#0000ffff' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'None' })).toHaveAttribute('data-none');
  });

  it('applies on click', () => {
    const { onSelect } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Green' }));
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(onSelect.mock.calls).toEqual([['#00ff00ff', OPTIONS[2]], [null, OPTIONS[0]]]);
  });

  it('routes shift-click and right-click to the alternate target', () => {
    const onAltSelect = vi.fn();
    const { onSelect } = mount({ onAltSelect });
    fireEvent.click(screen.getByRole('button', { name: 'Red' }), { shiftKey: true });
    const notPrevented = fireEvent.contextMenu(screen.getByRole('button', { name: 'Green' }));
    expect(onAltSelect.mock.calls).toEqual([['#ff0000ff', OPTIONS[1]], ['#00ff00ff', OPTIONS[2]]]);
    expect(notPrevented).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('leaves right-click to the browser with no alternate target', () => {
    mount();
    expect(fireEvent.contextMenu(screen.getByRole('button', { name: 'Green' }))).toBe(true);
  });

  it('marks the swatch matching value as current', () => {
    mount({ value: '#ff0000ff' });
    expect(screen.getByRole('button', { name: 'Red' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Green' })).not.toHaveAttribute('aria-current');
  });

  it('is one tab stop, on the current swatch', () => {
    mount({ value: '#00ff00ff' });
    const stops = screen.getAllByRole('button').filter((b) => b.tabIndex === 0);
    expect(stops.map((b) => b.getAttribute('aria-label'))).toEqual(['Green']);
  });

  it('moves the tab stop with focus, so Tab leaves the palette, and puts it back on the current swatch as focus leaves', () => {
    render(
      <>
        <SwatchGrid options={OPTIONS} onSelect={() => {}} columns={3} value="#00ffffff" aria-label="Colors" />
        <button type="button">after</button>
      </>,
    );
    const stops = () => screen.getAllByRole('button').filter((b) => b.tabIndex === 0).map((b) => b.getAttribute('aria-label') ?? b.textContent);
    const cyan = screen.getByRole('button', { name: 'Cyan' });
    act(() => cyan.focus());
    fireEvent.keyDown(cyan, { key: 'ArrowLeft' });
    expect(stops()).toEqual(['Yellow', 'after']);
    act(() => screen.getByRole('button', { name: 'after' }).focus());
    expect(stops()).toEqual(['Cyan', 'after']);
  });

  it('moves focus by one across and by a row up and down', () => {
    mount();
    const red = screen.getByRole('button', { name: 'Red' });
    red.focus();
    fireEvent.keyDown(red, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Green' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cyan' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'None' }));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cyan' }));
  });

  it('sends Shift+Enter to the alternate target', () => {
    const onAltSelect = vi.fn();
    mount({ onAltSelect });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Red' }), { key: 'Enter', shiftKey: true });
    expect(onAltSelect).toHaveBeenCalledWith('#ff0000ff', OPTIONS[1]);
  });

  describe('options keyed apart from their color', () => {
    const CERULEAN = '#2a7ab0ff';
    const TAPES: SwatchGridOption[] = [
      { id: 'none', value: null, label: 'No tape' },
      { id: 'cerulean-white', value: CERULEAN, label: 'Cerulean, white text', glyph: 'A', ink: '#ffffffff' },
      { id: 'cerulean-black', value: CERULEAN, label: 'Cerulean, black text', glyph: 'A', ink: '#000000ff' },
    ];

    it('hands back the id of the swatch applied, with the option', () => {
      const onAltSelect = vi.fn();
      const { onSelect } = mount({ options: TAPES, onAltSelect });
      fireEvent.click(screen.getByRole('button', { name: 'Cerulean, black text' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cerulean, white text' }), { shiftKey: true });
      expect(onSelect.mock.calls).toEqual([['cerulean-black', TAPES[2]]]);
      expect(onAltSelect.mock.calls).toEqual([['cerulean-white', TAPES[1]]]);
    });

    it('marks only the swatch whose id is the value, and puts the tab stop on it', () => {
      mount({ options: TAPES, value: 'cerulean-black' });
      expect(screen.getByRole('button', { name: 'Cerulean, black text' })).toHaveAttribute('aria-current', 'true');
      expect(screen.getByRole('button', { name: 'Cerulean, white text' })).not.toHaveAttribute('aria-current');
      const stops = screen.getAllByRole('button').filter((b) => b.tabIndex === 0);
      expect(stops.map((b) => b.getAttribute('aria-label'))).toEqual(['Cerulean, black text']);
    });

    it('draws both swatches of one color, roving from one to the other', () => {
      mount({ options: TAPES });
      const white = screen.getByRole('button', { name: 'Cerulean, white text' });
      white.focus();
      fireEvent.keyDown(white, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerulean, black text' }));
    });

    it('draws the glyph over the paint in its ink, leaving the name to the label', () => {
      mount({ options: TAPES });
      const black = screen.getByRole('button', { name: 'Cerulean, black text' });
      expect(black.style.getPropertyValue('--swatch')).toBe(CERULEAN);
      expect(black.style.getPropertyValue('--swatch-ink')).toBe('#000000ff');
      expect(within(black).getByText('A')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByRole('button', { name: 'No tape' })).toBeEmptyDOMElement();
    });

    it('records the color applied, not the id', () => {
      const store = createRecentColorsStore({ storage: null });
      render(
        <RecentColorsProvider store={store}>
          <SwatchGrid options={TAPES} onSelect={() => {}} aria-label="Tapes" />
        </RecentColorsProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cerulean, white text' }));
      expect(store.get()).toEqual([CERULEAN]);
    });
  });
});

describe('SwatchButton', () => {
  const red = OPTIONS[1]!;
  it("runs a caller's onClick before applying, and a prevented one applies nothing", () => {
    const onSelect = vi.fn();
    const onClick = vi.fn();
    const { rerender } = render(<SwatchButton option={red} tabStop current={false} apply={{ onSelect, onAltSelect: undefined }} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledOnce();
    rerender(<SwatchButton option={red} tabStop current={false} apply={{ onSelect, onAltSelect: undefined }} onClick={(e) => e.preventDefault()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('passes native and data attributes through, keeping its own tab stop', () => {
    render(<SwatchButton option={red} tabStop={false} current apply={{ onSelect: () => {}, onAltSelect: undefined }} data-slot="2" aria-describedby="why" />);
    const swatch = screen.getByRole('button', { name: 'Red' });
    expect(swatch).toHaveAttribute('data-slot', '2');
    expect(swatch).toHaveAttribute('aria-describedby', 'why');
    expect(swatch).toHaveAttribute('tabindex', '-1');
    expect(swatch).toHaveAttribute('aria-current', 'true');
  });
});
