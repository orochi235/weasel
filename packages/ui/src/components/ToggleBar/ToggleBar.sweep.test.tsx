import { afterEach, describe, it, expect } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { ToggleBar } from './ToggleBar';
import type { ToggleBarSweep } from './ToggleSweep';

const ITEMS = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C', disabled: true },
  { value: 'd', label: 'D' },
  { value: 'e', label: 'E' },
];

afterEach(() => { delete (document as { elementFromPoint?: unknown }).elementFromPoint; });

function Bar({ initial = [], sweep = true, seen }: { initial?: string[]; sweep?: ToggleBarSweep<string>; seen: string[][] }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <ToggleBar
      mode="multiple"
      items={ITEMS}
      value={value}
      sweep={sweep}
      onChange={(next) => { seen.push(next); setValue(next); }}
      ariaLabel="cells"
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

describe('ToggleBar sweep', () => {
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
