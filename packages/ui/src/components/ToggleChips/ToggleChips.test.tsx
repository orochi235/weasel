import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ToggleChips } from './ToggleChips';

const ITEMS = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C', disabled: true },
  { value: 'd', label: 'D' },
  { value: 'e', label: 'E' },
];

afterEach(() => { delete (document as { elementFromPoint?: unknown }).elementFromPoint; });

function Chips({ initial = [], sweep, seen = [] }: { initial?: string[]; sweep?: boolean; seen?: string[][] }) {
  const [value, setValue] = useState<string[]>(initial);
  return <ToggleChips aria-label="letters" items={ITEMS} value={value} sweep={sweep} onChange={(next) => { seen.push(next); setValue(next); }} />;
}

const pressed = () => screen.getAllByRole('button').map((b) => b.getAttribute('aria-pressed'));

describe('ToggleChips', () => {
  it('is a named group of toggle buttons, each marking its state', () => {
    render(<ToggleChips aria-label="letters" items={ITEMS} value={['b']} mixedValues={['d']} onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'letters' })).toBeTruthy();
    expect(pressed()).toEqual(['false', 'true', 'false', 'mixed', 'false']);
    expect(screen.getAllByRole('button').map((b) => b.dataset.state)).toEqual(['off', 'on', 'off', 'mixed', 'off']);
  });

  it('flips a chip on a click, and turns a mixed one on', () => {
    const onChange = vi.fn();
    render(<ToggleChips items={ITEMS} value={['b']} mixedValues={['d']} onChange={onChange} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]!);
    expect(onChange).toHaveBeenLastCalledWith(['b', 'a']);
    fireEvent.click(buttons[1]!);
    expect(onChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(buttons[3]!);
    expect(onChange).toHaveBeenLastCalledWith(['b', 'd']);
  });

  it('ignores a disabled chip, and every chip when the set is read-only', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ToggleChips items={ITEMS} value={[]} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button')[2]!);
    rerender(<ToggleChips items={ITEMS} value={[]} onChange={onChange} readOnly />);
    fireEvent.click(screen.getAllByRole('button')[0]!);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves focus with the arrows, skipping a disabled chip, and flips the focused chip with Space', () => {
    render(<Chips />);
    const buttons = screen.getAllByRole('button');
    act(() => buttons[1]!.focus());
    fireEvent.keyDown(buttons[1]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(buttons[3]);
    expect(pressed()).toEqual(['false', 'false', 'false', 'false', 'false']);
    fireEvent.keyDown(buttons[3]!, { key: ' ' });
    expect(pressed()).toEqual(['false', 'false', 'false', 'true', 'false']);
    fireEvent.keyDown(buttons[3]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(buttons[1]);
    fireEvent.keyDown(buttons[1]!, { key: 'Enter' });
    expect(pressed()).toEqual(['false', 'true', 'false', 'true', 'false']);
  });

  describe('sweep', () => {
    /** Lays the chips out as 10px columns and returns a pointer driver. */
    function setup(initial: string[] = []) {
      const seen: string[][] = [];
      render(<Chips initial={initial} sweep seen={seen} />);
      const buttons = screen.getAllByRole('button');
      document.elementFromPoint = (x: number) => buttons[Math.floor(x / 10)] ?? null;
      const fire = (type: string, x: number): void => {
        const el = buttons[Math.floor(x / 10)] ?? buttons[0]!;
        act(() => {
          el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: 5 }));
        });
      };
      return { seen, buttons, fire };
    }

    it('sets every chip a drag reaches to what the press set the first to, skipping a disabled one', () => {
      const { fire } = setup();
      fire('pointerdown', 5);
      fire('pointermove', 45);
      fire('pointerup', 45);
      expect(pressed()).toEqual(['true', 'true', 'false', 'true', 'true']);
      fire('pointerdown', 15);
      fire('pointermove', 35);
      fire('pointerup', 35);
      expect(pressed()).toEqual(['true', 'false', 'false', 'false', 'true']);
    });

    it('does not take the click a sweep ends with for a toggle', () => {
      const { seen, fire, buttons } = setup();
      fire('pointerdown', 5);
      fire('pointermove', 15);
      fire('pointerup', 15);
      fireEvent.click(buttons[1]!);
      expect(seen).toEqual([['a'], ['a', 'b']]);
    });

    it('puts the chips back when the sweep is canceled', () => {
      const { fire } = setup(['e']);
      fire('pointerdown', 5);
      fire('pointermove', 35);
      fire('pointercancel', 35);
      expect(pressed()).toEqual(['false', 'false', 'false', 'false', 'true']);
    });
  });
});
