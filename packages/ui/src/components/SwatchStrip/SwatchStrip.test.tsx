import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { createRecentColorsStore, RecentColorsProvider } from '../RecentColors';
import { SwatchStrip, describeColor } from './SwatchStrip';
import type { SwatchPalette } from './palettes';

const WARM: SwatchPalette = {
  id: 'warm',
  name: 'Warm',
  colors: [{ value: '#ff0000ff', label: 'Red' }, { value: '#ff8800ff', label: 'Orange' }],
};
const COOL: SwatchPalette = {
  id: 'cool',
  name: 'Cool',
  colors: [{ value: '#0000ffff', label: 'Blue' }, { value: '#00ffffff', label: 'Cyan' }],
};

function recents() {
  return screen.getByRole('group', { name: 'Recent colors' });
}

describe('describeColor', () => {
  it('says the hex, and the opacity when it is not opaque', () => {
    expect(describeColor('#ff0000ff')).toBe('#ff0000');
    expect(describeColor('#ff000080')).toBe('#ff0000, 50% opacity');
    expect(describeColor('rebeccapurple')).toBe('rebeccapurple');
  });
});

describe('SwatchStrip', () => {
  it('shows the recents most recent first, each named by its color', () => {
    const store = createRecentColorsStore({ storage: null });
    store.record(['#00ff00ff', '#ff000080']);
    render(<SwatchStrip store={store} palettes={[WARM]} onChange={() => {}} />);
    const names = within(recents()).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['#00ff00', '#ff0000, 50% opacity']);
  });

  it('says so when there are no recents yet', () => {
    render(<SwatchStrip store={createRecentColorsStore({ storage: null })} palettes={[WARM]} onChange={() => {}} />);
    expect(screen.getByText('No recent colors')).toBeInTheDocument();
  });

  it('leaves the recent row out with no store', () => {
    render(<SwatchStrip palettes={[WARM]} onChange={() => {}} />);
    expect(screen.queryByRole('group', { name: 'Recent colors' })).toBeNull();
  });

  it('puts an applied preset at the head of the recents', () => {
    const store = createRecentColorsStore({ storage: null });
    store.record('#123456ff');
    const onChange = vi.fn();
    render(<SwatchStrip store={store} palettes={[WARM]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Orange' }));
    expect(onChange).toHaveBeenCalledWith('#ff8800ff');
    const first = within(recents()).getAllByRole('button')[0];
    expect(first).toHaveAccessibleName('#ff8800');
  });

  it("reads the provider's store when given none", () => {
    const store = createRecentColorsStore({ storage: null });
    render(
      <RecentColorsProvider store={store}>
        <SwatchStrip palettes={[WARM]} onChange={() => {}} />
      </RecentColorsProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    expect(within(recents()).getAllByRole('button')[0]).toHaveAccessibleName('#ff0000');
  });

  it('marks the current color in the recents whatever its spelling', () => {
    const store = createRecentColorsStore({ storage: null });
    store.record(['#00ff00ff', '#ff0000ff']);
    render(<SwatchStrip store={store} palettes={[WARM]} value="#FF0000" onChange={() => {}} />);
    expect(within(recents()).getByRole('button', { name: '#ff0000' })).toHaveAttribute('aria-current', 'true');
  });

  it('switches palettes through the palette picker', () => {
    const onPaletteChange = vi.fn();
    render(<SwatchStrip palettes={[WARM, COOL]} onChange={() => {}} onPaletteChange={onPaletteChange} />);
    expect(screen.getByRole('group', { name: 'Warm' })).toBeInTheDocument();
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Palette/ })); });
    fireEvent.click(screen.getByRole('option', { name: 'Cool' }));
    expect(onPaletteChange).toHaveBeenCalledWith('cool');
    expect(screen.getByRole('group', { name: 'Cool' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Blue' })).toBeInTheDocument();
  });

  it('shows one palette with no picker', () => {
    render(<SwatchStrip palettes={[WARM]} onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: /Palette/ })).toBeNull();
    expect(screen.getByRole('group', { name: 'Warm' })).toBeInTheDocument();
  });

  it('defaults to the built-in palettes', () => {
    render(<SwatchStrip onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Standard' })).toBeInTheDocument();
  });

  it('moves focus along the recents with the arrow keys', () => {
    const store = createRecentColorsStore({ storage: null });
    store.record(['#111111ff', '#222222ff', '#333333ff']);
    render(<SwatchStrip store={store} palettes={[WARM]} onChange={() => {}} />);
    const [a, b] = within(recents()).getAllByRole('button');
    a.focus();
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(b);
  });
});
