import '@weasel-js/theme/tokens.css';
import '../Popover/Popover.browser.test.css';
import { cleanup, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { Focusable } from './Focusable';
import { Tooltip, TooltipTrigger } from './Tooltip';

// Where React Aria places an overlay is measured layout, and under a CSS transform: a real browser's.

afterEach(cleanup);

const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
};

function Scaled({ scale }: { scale: number }) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setBox} className="wzl-popover-test-box" data-scale={scale}>
      <TooltipTrigger isOpen>
        <Focusable>
          <button type="button" className="wzl-popover-test-trigger">
            Save
          </button>
        </Focusable>
        {box ? (
          <Tooltip portalContainer={box} placement="bottom" offset={12}>
            Save the document
          </Tooltip>
        ) : null}
      </TooltipTrigger>
    </div>
  );
}

it.each([1, 1.5, 2])('opens a tooltip against its trigger inside a box drawn at %s×', async (scale) => {
  const { container } = render(<Scaled scale={scale} />);
  await frames(3);
  const trigger = container.querySelector('button')!.getBoundingClientRect();
  const tip = container.querySelector('[role="tooltip"]')!.getBoundingClientRect();
  // The offset is the tooltip's own px, so it is drawn at the box's scale like everything else in it.
  expect(tip.top).toBeCloseTo(trigger.bottom + 12 * scale, 0);
  expect(tip.left + tip.width / 2).toBeCloseTo(trigger.left + trigger.width / 2, 0);
});
