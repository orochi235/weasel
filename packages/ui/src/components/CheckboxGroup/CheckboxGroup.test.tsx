import { afterEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { CheckboxGroup, type CheckboxGroupProps } from './CheckboxGroup';

const ITEMS = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C', disabled: true },
  { value: 'd', label: 'D' },
];

afterEach(() => { delete (document as { elementFromPoint?: unknown }).elementFromPoint; });

function Group({ initial, seen, ...rest }: { initial: string[]; seen: string[][] } & Partial<CheckboxGroupProps<string>>) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <CheckboxGroup aria-label="Letters" items={ITEMS} {...rest} value={value}
      onChange={(next) => { seen.push(next); setValue(next); }} />
  );
}

const boxes = (role: 'checkbox' | 'switch' = 'checkbox') => screen.getAllByRole(role) as HTMLInputElement[];
const checked = (role: 'checkbox' | 'switch' = 'checkbox') => boxes(role).map((b) => b.checked);

describe('CheckboxGroup', () => {
  it('names its group and flips one box on a click', () => {
    const seen: string[][] = [];
    render(<Group initial={['a']} seen={seen} />);
    expect(screen.getByRole('group', { name: 'Letters' })).toBeTruthy();
    fireEvent.click(boxes()[1]!);
    expect(seen).toEqual([['a', 'b']]);
    expect(checked()).toEqual([true, true, false, false]);
  });

  it('solos a box on Alt-click, leaving a disabled one alone, and turns every one back on with a second', () => {
    const seen: string[][] = [];
    render(<Group initial={['a', 'b', 'c']} seen={seen} />);
    fireEvent.click(boxes()[3]!, { altKey: true });
    expect(checked()).toEqual([false, false, true, true]);
    fireEvent.click(boxes()[3]!, { altKey: true });
    expect(checked()).toEqual([true, true, true, true]);
    expect(seen).toHaveLength(2);
  });

  it('solos a switch on Alt-click too', () => {
    const seen: string[][] = [];
    render(<Group initial={['a', 'b', 'd']} seen={seen} control="switch" />);
    fireEvent.click(boxes('switch')[0]!, { altKey: true });
    expect(checked('switch')).toEqual([true, false, false, false]);
    fireEvent.click(boxes('switch')[0]!, { altKey: true });
    expect(checked('switch')).toEqual([true, true, false, true]);
  });

  it('draws a mixed value as an indeterminate box, which a click turns on', () => {
    const seen: string[][] = [];
    render(<Group initial={[]} seen={seen} mixedValues={['b']} />);
    expect(boxes()[1]!.indeterminate).toBe(true);
    fireEvent.click(boxes()[1]!);
    expect(seen).toEqual([['b']]);
  });

  it('changes nothing while read-only', () => {
    const seen: string[][] = [];
    render(<Group initial={['a']} seen={seen} readOnly />);
    fireEvent.click(boxes()[1]!);
    fireEvent.click(boxes()[1]!, { altKey: true });
    expect(seen).toEqual([]);
  });

  describe('sweep', () => {
    function setup(initial: string[]) {
      const seen: string[][] = [];
      render(<Group initial={initial} seen={seen} sweep />);
      const items = boxes().map((b) => b.closest('[data-sweep-index]')!);
      // Each item a 10px row.
      document.elementFromPoint = (_x: number, y: number) => items[Math.floor(y / 10)] ?? null;
      const fire = (type: string, y: number, init: PointerEventInit = {}): void => {
        act(() => {
          (items[Math.floor(y / 10)] ?? items[0]!).dispatchEvent(new PointerEvent(type, {
            bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: 5, clientY: y, ...init,
          }));
        });
      };
      return { seen, fire };
    }

    it('sets every box a drag reaches to what the press set the first, skipping a disabled one', () => {
      const { fire } = setup([]);
      fire('pointerdown', 5);
      fire('pointermove', 35);
      fire('pointerup', 35);
      expect(checked()).toEqual([true, true, false, true]);
    });

    it('solos the boxes an Alt-drag reaches', () => {
      const { fire } = setup(['a', 'b', 'd']);
      fire('pointerdown', 5, { altKey: true });
      fire('pointermove', 15, { altKey: true });
      fire('pointerup', 15, { altKey: true });
      expect(checked()).toEqual([true, true, false, false]);
    });

    it('does not take the click a sweep ends with for a flip', () => {
      const { fire, seen } = setup([]);
      fire('pointerdown', 5);
      fire('pointermove', 15);
      fire('pointerup', 15);
      fireEvent.click(boxes()[1]!);
      expect(seen.at(-1)).toEqual(['a', 'b']);
      expect(checked()).toEqual([true, true, false, false]);
    });
  });
});
