import { afterEach, describe, it, expect } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { SegmentedBar } from './SegmentedBar';
import type { SegmentSweep } from './segmentSweep';

const ITEMS = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C', disabled: true },
  { value: 'd', label: 'D' },
  { value: 'e', label: 'E' },
];

afterEach(() => { delete (document as { elementFromPoint?: unknown }).elementFromPoint; });

function Bar({ initial = [], sweep = true, seen }: { initial?: string[]; sweep?: SegmentSweep<string>; seen: string[][] }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <SegmentedBar
      mode="multiple"
      items={ITEMS}
      value={value}
      sweep={sweep}
      onChange={(next) => { seen.push(next); setValue(next); }}
      aria-label="cells"
    />
  );
}

/** Lays the buttons out as 10px columns and returns a pointer driver. */
function setup(props: Omit<Parameters<typeof Bar>[0], 'seen'>) {
  const seen: string[][] = [];
  const utils = render(<Bar {...props} seen={seen} />);
  const buttons = utils.getAllByRole('button');
  document.elementFromPoint = (x: number) => buttons[Math.floor(x / 10)] ?? null;
  const fire = (type: string, x: number, init: PointerEventInit = {}): void => {
    const el = buttons[Math.floor(x / 10)] ?? buttons[0]!;
    act(() => {
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: 5, ...init }));
    });
  };
  const pressed = () => buttons.map((b) => b.getAttribute('aria-pressed'));
  return { seen, buttons, fire, pressed };
}

describe('SegmentedBar sweep', () => {
  it('turns on every segment a drag reaches from an off one, skipping a disabled one', () => {
    const { fire, pressed } = setup({});
    fire('pointerdown', 5);
    fire('pointermove', 15);
    fire('pointermove', 45);
    fire('pointerup', 45);
    expect(pressed()).toEqual(['true', 'true', 'false', 'true', 'true']);
  });

  it('turns off every segment a drag reaches from an on one', () => {
    const { fire, pressed } = setup({ initial: ['a', 'b', 'e'] });
    fire('pointerdown', 5);
    fire('pointermove', 45);
    fire('pointerup', 45);
    expect(pressed()).toEqual(['false', 'false', 'false', 'false', 'false']);
  });

  it('leaves a click in place a click: one toggle', () => {
    const { seen, buttons } = setup({});
    act(() => {
      buttons[1]!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: 15, clientY: 5 }));
      buttons[1]!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, button: 0, clientX: 15, clientY: 5 }));
    });
    fireEvent.click(buttons[1]!);
    expect(seen).toEqual([['b']]);
  });

  it('does not take the click a sweep ends with for a toggle', () => {
    const { seen, fire, buttons } = setup({});
    fire('pointerdown', 5);
    fire('pointermove', 15);
    fire('pointerup', 15);
    fireEvent.click(buttons[1]!);
    expect(seen).toEqual([['a'], ['a', 'b']]);
  });

  it('puts the value back when the sweep is canceled', () => {
    const { fire, pressed } = setup({ initial: ['e'] });
    fire('pointerdown', 5);
    fire('pointermove', 35);
    fire('pointercancel', 35);
    expect(pressed()).toEqual(['false', 'false', 'false', 'false', 'true']);
  });

  it('sweeps across the rows of a wrapped bar, along the line the drag takes', () => {
    const seen: string[][] = [];
    const cells = Array.from({ length: 9 }, (_, i) => ({ value: String(i), label: String(i) }));
    function Grid() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <SegmentedBar mode="multiple" columns={3} sweep items={cells} value={value}
          onChange={(next) => { seen.push(next); setValue(next); }} aria-label="grid" />
      );
    }
    const utils = render(<Grid />);
    const buttons = utils.getAllByRole('button');
    // Three 10px columns by three 10px rows.
    document.elementFromPoint = (x: number, y: number) => buttons[Math.floor(y / 10) * 3 + Math.floor(x / 10)] ?? null;
    const at = (type: string, x: number, y: number): void => {
      act(() => {
        buttons[0]!.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: y }));
      });
    };
    // Corner to corner, one move: the diagonal's cells, nothing beside them.
    at('pointerdown', 5, 5);
    at('pointermove', 25, 25);
    at('pointerup', 25, 25);
    expect(seen.at(-1)).toEqual(['0', '4', '8']);
  });

  it('asks a sweep function per press, with the modifiers held', () => {
    const { fire, pressed } = setup({ sweep: (p) => p.modifiers.alt });
    fire('pointerdown', 5);
    fire('pointermove', 25);
    fire('pointerup', 25);
    expect(pressed()).toEqual(['false', 'false', 'false', 'false', 'false']);
    fire('pointerdown', 5, { altKey: true });
    fire('pointermove', 25, { altKey: true });
    fire('pointerup', 25, { altKey: true });
    expect(pressed()).toEqual(['true', 'true', 'false', 'false', 'false']);
  });
});
