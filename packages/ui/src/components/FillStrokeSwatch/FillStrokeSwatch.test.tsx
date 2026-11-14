import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import type { Paint } from '@weasel-js/core';
import { FillStrokeSwatch, type FillStrokeSwatchProps } from './FillStrokeSwatch';
import { createRecentColorsStore } from '../RecentColors/recentColors';
import { RecentColorsProvider } from '../RecentColors/RecentColorsProvider';
import { renderWithIcons } from '../../testing/withIcons';

const RED: Paint = { kind: 'solid', color: '#ff0000ff' };
const BLUE: Paint = { kind: 'solid', color: '#0000ffff' };
const GRADIENT: Paint = {
  kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
  stops: [{ offset: 0, color: '#ff0000ff' }, { offset: 1, color: '#0000ffff' }], units: 'bounds',
};

function mount(over: Partial<FillStrokeSwatchProps> = {}) {
  const props: FillStrokeSwatchProps = {
    fill: RED,
    stroke: BLUE,
    focused: 'fill',
    onFocusChange: vi.fn(),
    onChange: vi.fn(),
    ...over,
  };
  renderWithIcons(<FillStrokeSwatch {...props} />);
  return props;
}

const chip = (name: 'Fill' | 'Stroke') => screen.getByRole('button', { name });

/** Opens a chip's paint editor and returns the dialog it opened. */
function open(name: 'Fill' | 'Stroke'): HTMLElement {
  fireEvent.click(chip(name));
  return screen.getByRole('dialog', { name: `${name} editor` });
}

/** The color input of the editor's solid body. */
function solidInput(editor: HTMLElement): HTMLInputElement {
  return editor.querySelector('input[type="color"]') as HTMLInputElement;
}

describe('FillStrokeSwatch', () => {
  it('names the pair as a group and each chip by its slot', () => {
    mount();
    expect(screen.getByRole('group', { name: 'Fill and stroke' })).toBeInTheDocument();
    expect(chip('Fill')).toHaveAttribute('aria-haspopup', 'dialog');
    expect(chip('Stroke')).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('marks the focused slot current', () => {
    mount({ focused: 'stroke' });
    expect(chip('Stroke')).toHaveAttribute('aria-current', 'true');
    expect(chip('Fill')).not.toHaveAttribute('aria-current');
  });

  it('focuses a slot on click or keyboard focus', () => {
    const p = mount();
    fireEvent.focus(chip('Fill'));
    expect(p.onFocusChange).toHaveBeenCalledWith('fill');
    fireEvent.click(chip('Stroke'));
    expect(p.onFocusChange).toHaveBeenCalledWith('stroke');
  });

  it("opens the slot's whole paint editor, not a color input", () => {
    mount();
    const editor = open('Fill');
    expect(within(editor).getByRole('radiogroup', { name: 'Paint kind' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fill', hidden: true })).toHaveAttribute('aria-expanded', 'true');
  });

  it('streams a solid edit as a Paint and commits it once', () => {
    const onInput = vi.fn();
    const p = mount({ onInput });
    const input = solidInput(open('Fill'));
    fireEvent.input(input, { target: { value: '#00ff00' } });
    fireEvent.blur(input);
    expect(onInput).toHaveBeenCalledWith('fill', { color: '#00ff00' });
    expect(p.onChange).toHaveBeenCalledTimes(1);
    expect(p.onChange).toHaveBeenCalledWith('fill', { color: '#00ff00' });
  });

  it('edits a gradient slot as a gradient', () => {
    const p = mount({ fill: GRADIENT });
    const editor = open('Fill');
    const stop = within(editor).getByLabelText('Stop 1');
    fireEvent.input(stop, { target: { value: '#00ff00' } });
    fireEvent.blur(stop);
    expect(p.onChange).toHaveBeenCalledTimes(1);
    expect(p.onChange).toHaveBeenCalledWith('fill', expect.objectContaining({
      kind: 'linear-gradient',
      stops: [
        { offset: 0, color: '#00ff00ff' },
        { offset: 1, color: '#0000ffff' },
      ],
    }));
  });

  it('turns a solid slot into a gradient from the kind bar', () => {
    const p = mount();
    fireEvent.click(within(open('Stroke')).getByRole('radio', { name: 'Linear' }));
    expect(p.onChange).toHaveBeenCalledWith('stroke', expect.objectContaining({ kind: 'linear-gradient' }));
  });

  it('commits nothing when the editor closes untouched', () => {
    const p = mount();
    const input = solidInput(open('Fill'));
    fireEvent.blur(input);
    expect(p.onChange).not.toHaveBeenCalled();
  });

  it('records the color of the paint a consumer says it applied', () => {
    const store = createRecentColorsStore({ storage: null });
    renderWithIcons(
      <RecentColorsProvider store={store}>
        <FillStrokeSwatch
          fill={RED}
          stroke={BLUE}
          focused="fill"
          onFocusChange={() => {}}
          onChange={() => ({ kind: 'solid', color: '#12345680' })}
        />
      </RecentColorsProvider>,
    );
    const input = solidInput(open('Stroke'));
    fireEvent.input(input, { target: { value: '#123456' } });
    fireEvent.blur(input);
    expect(store.get()).toEqual(['#12345680']);
  });

  it('shift-click toggles none without opening the editor', () => {
    const p = mount({ onToggleNone: vi.fn() });
    fireEvent.click(chip('Stroke'), { shiftKey: true });
    expect(p.onToggleNone).toHaveBeenCalledWith('stroke');
    expect(p.onFocusChange).toHaveBeenCalledWith('stroke');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the editor on a shift-click with no onToggleNone', () => {
    mount();
    fireEvent.click(chip('Stroke'), { shiftKey: true });
    expect(screen.getByRole('dialog', { name: 'Stroke editor' })).toBeInTheDocument();
  });

  it('None acts on the focused slot and reads pressed when it holds none', () => {
    const onToggleNone = vi.fn();
    mount({ fill: null, focused: 'fill', onToggleNone });
    const none = screen.getByRole('button', { name: 'None' });
    expect(none).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(none);
    expect(onToggleNone).toHaveBeenCalledWith('fill');
  });

  it('shows none as data-none on its chip', () => {
    mount({ stroke: null });
    expect(chip('Stroke').parentElement).toHaveAttribute('data-none');
    expect(chip('Fill').parentElement).not.toHaveAttribute('data-none');
  });

  it('renders Swap and Default only when handed their callbacks', () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Swap' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Default' })).toBeNull();
  });

  it('fires onSwap and onReset', () => {
    const onSwap = vi.fn();
    const onReset = vi.fn();
    mount({ onSwap, onReset });
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }));
    fireEvent.click(screen.getByRole('button', { name: 'Default' }));
    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
