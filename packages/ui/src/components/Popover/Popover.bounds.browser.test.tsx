import '@weasel-js/theme/tokens.css';
import './Popover.browser.test.css';
import { cleanup } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { Callout } from '../Callout';
import type { CalloutProps } from '../Callout';
import { renderWithIcons } from '../../testing/withIcons';

// Inside a box drawn at f×, the viewport's room is 1/f as many of the box's px: a popover must flip and limit its
// height against that, as it would against the viewport at 1×.

afterEach(cleanup);

const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
};

interface Case {
  scale: number;
  at?: 'low' | 'right';
  size: 'short' | 'tall' | 'wide';
  placement: CalloutProps['placement'];
}

function Scaled({ scale, at, size, placement }: Case) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setBox} className="wzl-popover-test-box" data-scale={scale} data-at={at}>
      <button ref={trigger} type="button" className="wzl-popover-test-trigger">
        Open
      </button>
      {box ? (
        <Callout
          triggerRef={trigger}
          portalContainer={box}
          isOpen
          placement={placement}
          offset={12}
          maxHeight={10_000}
          showCloseButton={false}
          aria-label="Menu"
        >
          <div className="wzl-popover-test-content" data-size={size} />
        </Callout>
      ) : null}
    </div>
  );
}

async function open(c: Case) {
  const { container } = renderWithIcons(<Scaled {...c} />);
  await frames(3);
  return {
    trigger: container.querySelector('button')!.getBoundingClientRect(),
    popover: container.querySelector('[data-weasel-overlay]')!.getBoundingClientRect(),
  };
}

it.each([1, 1.5, 2])('opens a top-placed callout against its trigger inside a box drawn at %s×', async (scale) => {
  const { trigger, popover } = await open({ scale, at: 'low', size: 'short', placement: 'top' });
  expect(popover.bottom).toBeCloseTo(trigger.top - 12 * scale, 0);
});

it('keeps a callout below its trigger at 1× where the room below holds it', async () => {
  const { trigger, popover } = await open({ scale: 1, at: 'low', size: 'short', placement: 'bottom' });
  expect(popover.top).toBeGreaterThanOrEqual(trigger.bottom);
});

it('flips a callout above its trigger at 2× where the room below no longer holds it', async () => {
  const { trigger, popover } = await open({ scale: 2, at: 'low', size: 'short', placement: 'bottom' });
  expect(popover.bottom).toBeLessThanOrEqual(trigger.top);
  expect(popover.top).toBeGreaterThanOrEqual(0);
});

it.each([1, 2])('limits a tall callout to the viewport inside a box drawn at %s×', async (scale) => {
  const { trigger, popover } = await open({ scale, size: 'tall', placement: 'bottom' });
  expect(popover.top).toBeGreaterThanOrEqual(trigger.bottom);
  expect(popover.bottom).toBeLessThanOrEqual(window.innerHeight);
  // Not cut to the box either: it reaches within the container padding of the viewport's edge.
  expect(popover.bottom).toBeGreaterThan(window.innerHeight - 13 * scale);
});

it.each([1, 2])('shifts a wide callout inside the viewport across its axis at %s×', async (scale) => {
  const { popover } = await open({ scale, at: 'right', size: 'wide', placement: 'bottom' });
  expect(popover.left).toBeGreaterThanOrEqual(0);
  expect(popover.right).toBeLessThanOrEqual(window.innerWidth);
});

it('leaves a wide callout centered on its trigger at 1× where the viewport holds it', async () => {
  const { trigger, popover } = await open({ scale: 1, at: 'right', size: 'wide', placement: 'bottom' });
  expect(popover.left + popover.width / 2).toBeCloseTo(trigger.left + trigger.width / 2, 0);
});

function Scroller({ isOpen }: { isOpen: boolean }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setBox} className="wzl-popover-test-scroller">
      <div className="wzl-popover-test-scroller-content" />
      <button ref={trigger} type="button" className="wzl-popover-test-trigger">
        Open
      </button>
      {box ? (
        <Callout
          triggerRef={trigger}
          portalContainer={box}
          isOpen={isOpen}
          placement="bottom"
          showCloseButton={false}
          aria-label="Menu"
        >
          <div className="wzl-popover-test-content" data-size="short" />
        </Callout>
      ) : null}
    </div>
  );
}

it('adds nothing to the scroll range of the positioned container it opens in', async () => {
  const { container, rerender } = renderWithIcons(<Scroller isOpen={false} />);
  await frames(2);
  const scroller = container.querySelector<HTMLElement>('.wzl-popover-test-scroller')!;
  const closed = { width: scroller.scrollWidth, height: scroller.scrollHeight };
  rerender(<Scroller isOpen />);
  await frames(3);
  expect(container.querySelector('[data-weasel-overlay]')).not.toBeNull();
  expect({ width: scroller.scrollWidth, height: scroller.scrollHeight }).toEqual(closed);
});
