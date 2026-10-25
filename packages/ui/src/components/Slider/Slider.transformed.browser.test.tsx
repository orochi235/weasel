import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Slider } from './Slider';

afterEach(cleanup);

/** Where the rail's own point at `fraction` along its centerline lands on screen: a zero-size mark placed there by
 *  layout, so the answer comes from the browser rather than from the geometry under test. */
function railPoint(rail: HTMLElement, fraction: number): { x: number; y: number } {
  const mark = document.createElement('div');
  mark.style.cssText = `position:absolute;left:${fraction * 100}%;top:50%;width:0;height:0`;
  rail.append(mark);
  const { left, top } = mark.getBoundingClientRect();
  mark.remove();
  return { x: left, y: top };
}

for (const transform of ['rotate(90deg)', 'rotate(-35deg) scale(0.75)', 'scale(0.5)']) {
  test(`under a ${transform} ancestor a press at three quarters of the rail reads 75`, () => {
    const onInput = vi.fn();
    const { container } = render(
      <div style={{ width: 300, margin: 160, transform }}>
        <Slider min={0} max={100} thumbs={[{ value: 10 }]} onInput={onInput} />
      </div>,
    );
    const rail = container.querySelector<HTMLElement>('[data-slider-rail]')!;
    const p = railPoint(rail, 0.75);
    const opts = { clientX: p.x, clientY: p.y, button: 0, bubbles: true, pointerId: 1 };
    document.elementFromPoint(p.x, p.y)!.dispatchEvent(new PointerEvent('pointerdown', opts));
    document.dispatchEvent(new PointerEvent('pointerup', opts));
    expect(onInput).toHaveBeenCalled();
    expect(Math.round(onInput.mock.calls.at(-1)![0][0].value)).toBe(75);
  });
}

test('under a rotate(90deg) ancestor readouts far apart along the rail share one row', () => {
  const { container } = render(
    <div style={{ width: 300, margin: 160, transform: 'rotate(90deg)' }}>
      <Slider min={0} max={100} thumbs={[{ value: 20 }, { value: 80 }]} readoutPlacement="below-thumb" onInput={() => {}} />
    </div>,
  );
  const tops = [...container.querySelectorAll<HTMLElement>('[data-readout="below"]')].map((el) => el.style.top);
  expect(tops).toEqual(['0px', '0px']);
});
