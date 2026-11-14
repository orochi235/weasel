import { beforeAll, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { Disabled, ReadOnly } from '../Disabled';
import { describeHold } from '../Disabled/testing/holdCases.fixtures';
import { BandEditor } from './BandEditor';
import type { Band } from './bands';

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 40, width: 400, height: 40, toJSON: () => {} } as DOMRect;
  };
});

const BANDS: Band<string>[] = [{ from: 0, data: 'a' }, { from: 20, data: 'b' }, { from: 60, data: 'c' }];

function drag(el: Element, from: number, to: number): void {
  fireEvent.pointerDown(el, { clientX: from, clientY: 20, button: 0 });
  fireEvent.pointerMove(document, { clientX: to, clientY: 20 });
  fireEvent.pointerUp(document, { clientX: to, clientY: 20 });
}

const q = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)];
const seams = () => q('[data-band-strip] [role="slider"]');
const bodies = () => q('[data-band-index]');
const edges = () => q('[data-range-edge]');

describeHold('BandEditor', (mount, own) => {
  const calls = { onInput: vi.fn(), onChange: vi.fn(), onRangeChange: vi.fn(), onRangeInput: vi.fn() };
  mount(<BandEditor value={BANDS} min={0} max={100} scale="linear" selectedIndex={1} label="Bands" {...calls} {...own} />);
  return {
    targets: () => [...bodies(), ...edges(), ...seams()],
    // The seams are the strip's slider; the editor tells its reason once, for all of it, so they take no description.
    described: () => [...bodies(), ...edges()],
    tryAll: () => {
      drag(seams()[0]!, 80, 120);
      fireEvent.keyDown(seams()[0]!, { key: 'ArrowRight' });
      drag(bodies()[1]!, 160, 200);
      drag(edges()[1]!, 400, 360);
      fireEvent.keyDown(edges()[0]!, { key: 'ArrowRight' });
      fireEvent.pointerDown(document.querySelector('[data-band-ruler]')!, { clientX: 40, clientY: 5, button: 0 });
      fireEvent.contextMenu(bodies()[1]!);
      for (const key of ['s', 'l', 'x']) fireEvent.keyDown(bodies()[1]!, { key });
    },
    changed: () => Object.values(calls).some((f) => f.mock.calls.length > 0),
  };
});

it('read-only, a band still selects; disabled, it does not', () => {
  const onSelectionChange = vi.fn();
  const editor = <BandEditor value={BANDS} min={0} max={100} scale="linear" onChange={() => {}} onSelectionChange={onSelectionChange} />;
  const { unmount } = render(<ReadOnly reason="Shared">{editor}</ReadOnly>);
  fireEvent.pointerDown(bodies()[2]!, { clientX: 300, clientY: 20, button: 0 });
  expect(onSelectionChange).toHaveBeenCalledWith(2);
  unmount();
  onSelectionChange.mockClear();
  render(<Disabled reason="Locked">{editor}</Disabled>);
  fireEvent.pointerDown(bodies()[2]!, { clientX: 300, clientY: 20, button: 0 });
  fireEvent.focus(bodies()[1]!);
  expect(onSelectionChange).not.toHaveBeenCalled();
  expect(document.querySelector('[role="group"]')).toHaveAttribute('data-held', 'disabled');
});
