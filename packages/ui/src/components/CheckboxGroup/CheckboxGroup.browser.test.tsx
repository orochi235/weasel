import '@weasel-js/theme/tokens.css';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { CheckboxGroup } from '@weasel-js/ui/components/CheckboxGroup';

// A sweep reaches a box by hit-testing the pointer against the laid-out labels, and the native box and React Aria's
// switch each take the press their own way, so whether a drag lands on each box, and only once, takes real layout.

afterEach(cleanup);

const NAMES = ['anchors', 'handles', 'bounds', 'hit areas'];

function Group({ control, orientation }: { control: 'checkbox' | 'switch'; orientation: 'vertical' | 'horizontal' }) {
  const [value, setValue] = useState<string[]>([]);
  return (
    <CheckboxGroup aria-label="Overlays" control={control} orientation={orientation} sweep
      items={NAMES.map((name) => ({ value: name, label: name }))} value={value} onChange={setValue} />
  );
}

function fire(type: string, at: { x: number; y: number }, init: PointerEventInit = {}): void {
  const el = document.elementFromPoint(at.x, at.y)!;
  act(() => {
    el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: at.x, clientY: at.y, ...init,
    }));
  });
}

const middle = (el: Element) => {
  const r = el.closest('[data-sweep-index]')!.getBoundingClientRect();
  return { x: r.left + Math.min(8, r.width / 2), y: r.top + r.height / 2 };
};

test.each([
  ['checkbox', 'vertical'],
  ['switch', 'vertical'],
  ['checkbox', 'horizontal'],
  ['switch', 'horizontal'],
] as const)('a drag across %s boxes laid out %s turns on each one it reaches, and an Alt-drag solos', (control, orientation) => {
  render(<Group control={control} orientation={orientation} />);
  const boxes = screen.getAllByRole(control) as HTMLInputElement[];
  const [first, second, third] = [0, 1, 2].map((i) => middle(boxes[i]!)) as [ReturnType<typeof middle>, ReturnType<typeof middle>, ReturnType<typeof middle>];
  fire('pointerdown', first);
  fire('pointermove', second);
  fire('pointermove', third);
  fire('pointerup', third);
  expect(boxes.map((b) => b.checked)).toEqual([true, true, true, false]);

  fire('pointerdown', first, { altKey: true });
  fire('pointermove', second, { altKey: true });
  fire('pointerup', second, { altKey: true });
  expect(boxes.map((b) => b.checked)).toEqual([true, true, false, false]);
});
