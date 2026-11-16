import '@weasel-js/theme/tokens.css';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { Badge } from '@weasel-js/ui/components/Badge';
import { ToggleChips } from '@weasel-js/ui/components/ToggleChips';

// A sweep reaches a chip by hit-testing the pointer against the laid-out chips, so whether a drag crosses onto a
// wrapped line, and whether an off chip draws dimmer than an on one, only real layout answers.

afterEach(cleanup);

const NAMES = ['core', 'geom', 'paint', 'stroke', 'renderer', 'minimap', 'parallax', 'diagram'];

function Chips() {
  const [value, setValue] = useState<string[]>(NAMES);
  return (
    <div style={{ width: 160 }}>
      <ToggleChips
        aria-label="Packages"
        sweep
        items={NAMES.map((name) => ({ value: name, label: <Badge size="sm" variant="subtle">{name}</Badge> }))}
        value={value}
        onChange={setValue}
      />
    </div>
  );
}

/** Fires `type` at the element the page draws at (`x`, `y`). */
function fire(type: string, x: number, y: number): void {
  const el = document.elementFromPoint(x, y)!;
  act(() => {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: x, clientY: y }));
  });
}

test('the chips wrap, a drag down onto the next line turns off both chips it crosses, and off chips draw dimmed', async () => {
  render(<Chips />);
  const chips = screen.getAllByRole('button');
  const top = (el: HTMLElement) => Math.round(el.getBoundingClientRect().top);
  const below = chips.find((chip) => top(chip) > top(chips[0]!));
  expect(below, 'the chips wrap onto a second line').toBeDefined();

  const from = chips[0]!.getBoundingClientRect();
  const to = below!.getBoundingClientRect();
  const x = from.left + 4;
  fire('pointerdown', x, from.top + from.height / 2);
  fire('pointermove', x, (from.bottom + to.top) / 2 + 1);
  fire('pointermove', x, to.top + to.height / 2);
  fire('pointerup', x, to.top + to.height / 2);

  const off = chips.filter((chip) => chip.getAttribute('aria-pressed') === 'false');
  expect(off).toEqual([chips[0], below]);
  const on = chips.find((chip) => chip.getAttribute('aria-pressed') === 'true')!;
  // Past the opacity transition.
  await expect.poll(() => Number(getComputedStyle(chips[0]!).opacity)).toBeLessThan(Number(getComputedStyle(on).opacity));
});
