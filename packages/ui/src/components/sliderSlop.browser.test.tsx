import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { InlineRange } from './InlineRange/InlineRange';
import { PropertyField } from './Properties/PropertyField';
import { RangeSlider } from './RangeSlider/RangeSlider';
import rs from './RangeSlider/RangeSlider.module.css';
import { Slider } from './Slider/Slider';

// A slop is invisible hit area, so the only way to see one is to ask real
// layout what a point lands on.

afterEach(cleanup);

const px = (name: string) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
const hit = (x: number, y: number) => document.elementFromPoint(x, y);
const lands = (el: Element, x: number, y: number) => {
  const h = hit(x, y);
  return h === el || el.contains(h);
};

function Frame({ children }: { children: React.ReactNode }) {
  return <div style={{ width: 240, padding: 40 }}>{children}</div>;
}

describe('Slider', () => {
  test('a press within the track slop lands on the track, and one past it does not', () => {
    const { container } = render(
      <Frame>
        <Slider density="slim" min={0} max={100} thumbs={[{ value: 90 }]} onInput={() => {}} />
      </Frame>,
    );
    const slop = px('--wzl-slider-track-slop');
    const track = container.querySelector('[data-slider-rail]')!.parentElement!;
    const r = track.getBoundingClientRect();
    const x = r.left + r.width * 0.25;
    expect(lands(track, x, r.top - slop + 1)).toBe(true);
    expect(lands(track, x, r.bottom + slop - 1)).toBe(true);
    expect(lands(track, r.left - slop + 1, r.top + r.height / 2)).toBe(true);
    expect(lands(track, x, r.top - slop - 1)).toBe(false);
  });

  test.each(['default', 'slim'] as const)("a %s thumb's slop sits over the track's", (density) => {
    render(
      <Frame>
        <Slider density={density} min={0} max={100} thumbs={[{ value: 50 }]} onInput={() => {}} />
      </Frame>,
    );
    const slop = px('--wzl-slider-thumb-slop');
    const thumb = screen.getByRole('slider');
    const r = thumb.getBoundingClientRect();
    const y = r.top + r.height / 2;
    expect(lands(thumb, r.right + slop - 1, y)).toBe(true);
    expect(lands(thumb, r.left - slop + 1, y)).toBe(true);
    expect(lands(thumb, r.left + r.width / 2, r.top - slop + 1)).toBe(true);
    expect(lands(thumb, r.right + slop + 1, y)).toBe(false);
  });
});

describe('RangeSlider', () => {
  test('a press within either slop lands on its element', () => {
    const { container } = render(
      <Frame>
        <RangeSlider aria-label="Level" defaultValue={50} />
      </Frame>,
    );
    const trackSlop = px('--wzl-slider-track-slop');
    const thumbSlop = px('--wzl-slider-thumb-slop');
    const thumb = container.querySelector(`.${rs.thumb}`)!;
    const track = thumb.parentElement!;
    const r = track.getBoundingClientRect();
    const x = r.left + r.width * 0.1;
    expect(lands(track, x, r.top - trackSlop + 1)).toBe(true);
    expect(lands(track, x, r.top - trackSlop - 1)).toBe(false);
    const t = thumb.getBoundingClientRect();
    const y = t.top + t.height / 2;
    expect(lands(thumb, t.right + thumbSlop - 1, y)).toBe(true);
    expect(lands(thumb, t.right + thumbSlop + 1, y)).toBe(false);
  });
});

describe('native range skin', () => {
  const cases = {
    InlineRange: () => <InlineRange value={50} onChange={() => {}} />,
    'a slider field': () => (
      <PropertyField kind="number" control="slider" label="Bevel" value={5} min={0} max={10} step={1} onChange={() => {}} />
    ),
    "a color field's alpha": () => (
      <PropertyField kind="color" label="Fill" value="#3b82f6" alpha={1} onChange={() => {}} onAlphaChange={() => {}} />
    ),
  };

  test.each(Object.entries(cases))('%s takes a press in its slop without moving its track', (_, make) => {
    const { container } = render(<Frame>{make()}</Frame>);
    const slop = px('--wzl-slider-track-slop');
    const input = container.querySelector('input[type="range"]')!;
    const box = input.getBoundingClientRect();
    // The track paints in the content box.
    const cs = getComputedStyle(input);
    const track = {
      left: box.left + parseFloat(cs.paddingLeft),
      right: box.right - parseFloat(cs.paddingRight),
      top: box.top + parseFloat(cs.paddingTop),
      bottom: box.bottom - parseFloat(cs.paddingBottom),
    };
    let host = input.parentElement!;
    while (getComputedStyle(host).display === 'contents') host = host.parentElement!;
    const parent = host.getBoundingClientRect();
    expect(track.left).toBeGreaterThanOrEqual(parent.left - 0.5);
    expect(track.right).toBeLessThanOrEqual(parent.right + 0.5);
    const x = track.left + (track.right - track.left) * 0.25;
    expect(lands(input, x, track.top - slop + 1)).toBe(true);
    expect(lands(input, x, track.bottom + slop - 1)).toBe(true);
    expect(lands(input, x, track.top - slop - 1)).toBe(false);
  });
});
