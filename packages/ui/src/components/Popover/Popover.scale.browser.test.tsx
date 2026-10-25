import '@weasel-js/theme/tokens.css';
import './Popover.browser.test.css';
import { cleanup } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { Callout } from '../Callout';
import { renderWithIcons } from '../../testing/withIcons';

// Where React Aria places an overlay is measured layout, and under a CSS transform: a real browser's.

afterEach(cleanup);

const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
};

function Scaled({ scale }: { scale: number }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setBox} className="wzl-popover-test-box" data-scale={scale}>
      <button ref={trigger} type="button" className="wzl-popover-test-trigger">
        Open
      </button>
      {box ? (
        <Callout triggerRef={trigger} portalContainer={box} isOpen placement="bottom" offset={12} showCloseButton={false} title="Menu">
          Item
        </Callout>
      ) : null}
    </div>
  );
}

it.each([1, 1.5, 2])('opens a callout against its trigger inside a box drawn at %s×', async (scale) => {
  const { container } = renderWithIcons(<Scaled scale={scale} />);
  await frames(3);
  const trigger = container.querySelector('button')!.getBoundingClientRect();
  const popover = container.querySelector('[data-weasel-overlay]')!.getBoundingClientRect();
  // The offset is the popover's own px, so it is drawn at the box's scale like everything else in it.
  expect(popover.top).toBeCloseTo(trigger.bottom + 12 * scale, 0);
  expect(popover.left + popover.width / 2).toBeCloseTo(trigger.left + trigger.width / 2, 0);
});
