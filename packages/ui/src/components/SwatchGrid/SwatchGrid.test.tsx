import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { createRecentColorsStore, RecentColorsProvider } from '../RecentColors';
import { SwatchGrid, type SwatchGridOption } from './SwatchGrid';

const OPTIONS: SwatchGridOption[] = [
  { value: null, label: 'None' },
  { value: '#ff0000ff', label: 'Red' },
  { value: '#00ff00ff', label: 'Green' },
  { value: '#0000ffff' },
  { value: '#ffff00ff', label: 'Yellow' },
  { value: '#00ffffff', label: 'Cyan' },
];

function mount(over: Partial<Parameters<typeof SwatchGrid>[0]> = {}) {
  const onChange = vi.fn();
  render(<SwatchGrid options={OPTIONS} onChange={onChange} columns={3} aria-label="Colors" {...over} />);
  return { onChange };
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
    const { onChange } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Green' }));
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(onChange.mock.calls).toEqual([['#00ff00ff', OPTIONS[2]], [null, OPTIONS[0]]]);
  });

  it('routes shift-click and right-click to the alternate target', () => {
    const onAltChange = vi.fn();
    const { onChange } = mount({ onAltChange });
    fireEvent.click(screen.getByRole('button', { name: 'Red' }), { shiftKey: true });
    const notPrevented = fireEvent.contextMenu(screen.getByRole('button', { name: 'Green' }));
    expect(onAltChange.mock.calls).toEqual([['#ff0000ff', OPTIONS[1]], ['#00ff00ff', OPTIONS[2]]]);
    expect(notPrevented).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
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
    const onAltChange = vi.fn();
    mount({ onAltChange });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Red' }), { key: 'Enter', shiftKey: true });
    expect(onAltChange).toHaveBeenCalledWith('#ff0000ff', OPTIONS[1]);
  });

  describe('options keyed apart from their color', () => {
    const CERULEAN = '#2a7ab0ff';
    const TAPES: SwatchGridOption[] = [
      { id: 'none', value: null, label: 'No tape' },
      { id: 'cerulean-white', value: CERULEAN, label: 'Cerulean, white text', glyph: 'A', ink: '#ffffffff' },
      { id: 'cerulean-black', value: CERULEAN, label: 'Cerulean, black text', glyph: 'A', ink: '#000000ff' },
    ];

    it('hands back the id of the swatch applied, with the option', () => {
      const onAltChange = vi.fn();
      const { onChange } = mount({ options: TAPES, onAltChange });
      fireEvent.click(screen.getByRole('button', { name: 'Cerulean, black text' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cerulean, white text' }), { shiftKey: true });
      expect(onChange.mock.calls).toEqual([['cerulean-black', TAPES[2]]]);
      expect(onAltChange.mock.calls).toEqual([['cerulean-white', TAPES[1]]]);
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
          <SwatchGrid options={TAPES} onChange={() => {}} aria-label="Tapes" />
        </RecentColorsProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cerulean, white text' }));
      expect(store.get()).toEqual([CERULEAN]);
    });
  });
});
