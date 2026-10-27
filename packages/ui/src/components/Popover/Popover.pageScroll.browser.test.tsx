import '@weasel-js/theme/tokens.css';
import './Popover.browser.test.css';
import { cleanup } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { Callout } from '../Callout';
import type { CalloutProps } from '../Callout';
import { renderWithIcons } from '../../testing/withIcons';

// A popover held in a fixed box places against a fixed overlay frame; scrolling the page must not move the room
// it flips and limits its height against.

const SCROLL = 400;

afterEach(() => {
  cleanup();
  window.scrollTo(0, 0);
});

const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
};

interface Case {
  /** The box near the viewport's bottom, or at its default spot 50px from the top. */
  low: boolean;
  size: 'short' | 'tall';
  placement: CalloutProps['placement'];
}

function Held({ low, size, placement }: Case) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <div className="wzl-popover-test-page" />
      <div ref={setBox} className="wzl-popover-test-box" data-at={low ? 'low' : undefined}>
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
    </>
  );
}

async function open(c: Case) {
  const { container, rerender } = renderWithIcons(<Held {...c} />);
  window.scrollTo(0, SCROLL);
  expect(window.scrollY).toBe(SCROLL);
  rerender(<Held {...c} />);
  await frames(3);
  return {
    trigger: container.querySelector('button')!.getBoundingClientRect(),
    popover: container.querySelector('[data-weasel-overlay]')!.getBoundingClientRect(),
  };
}

it('keeps a callout below its trigger in a scrolled page where the room below holds it', async () => {
  const { trigger, popover } = await open({ low: true, size: 'short', placement: 'bottom' });
  expect(popover.top).toBeGreaterThanOrEqual(trigger.bottom);
});

it('flips a callout below its trigger in a scrolled page where the room above does not hold it', async () => {
  // The trigger's top is 80px down the viewport: too little for 80px of callout and a 12px offset.
  const { trigger, popover } = await open({ low: false, size: 'short', placement: 'top' });
  expect(popover.top).toBeGreaterThanOrEqual(trigger.bottom);
});

it('limits a tall callout to the viewport, not short of it, in a scrolled page', async () => {
  const { trigger, popover } = await open({ low: false, size: 'tall', placement: 'bottom' });
  expect(popover.top).toBeGreaterThanOrEqual(trigger.bottom);
  expect(popover.bottom).toBeLessThanOrEqual(window.innerHeight);
  expect(popover.bottom).toBeGreaterThan(window.innerHeight - 13);
});
