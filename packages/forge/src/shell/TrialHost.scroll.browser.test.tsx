import './shell.css';
import { TrialTitleContext } from '@weasel-js/labkit';
import { cleanup, render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { runAxe } from '../frame/a11y';
import { TrialHost } from './TrialHost';

afterEach(cleanup);

let grow: () => void = () => {};

// axe judges a scroller only when it has content outside its visible rect, so the story's text sits below the fold.
function Story({ initial }: { initial: number }) {
  const [drop, setDrop] = useState(initial);
  grow = () => setDrop(1900);
  return (
    <div style={{ width: 400, height: 300 }}>
      <TrialTitleContext.Provider value="ColorRamp › Each Interpolation Space">
        <TrialHost layout="padded" setup={{}} config={{}}>
          {() => (
            <p data-testid="story" style={{ paddingTop: drop }}>
              Below the fold
            </p>
          )}
        </TrialHost>
      </TrialTitleContext.Provider>
    </div>
  );
}

const scrollerOf = (container: HTMLElement) => container.querySelector<HTMLElement>('.fg-story__scroll')!;
const audit = async (container: HTMLElement) =>
  (await runAxe(container.querySelector('.fg-story')!, { page: false })).violations.map((v) => v.id);

test('a story taller than its trial is a named, focusable scroll region, and axe finds nothing to blame on it', async () => {
  const { container, findByTestId } = render(<Story initial={1900} />);
  await findByTestId('story');
  const scroller = scrollerOf(container);
  await waitFor(() => expect(scroller.tabIndex).toBe(0));
  expect(scroller.getAttribute('role')).toBe('region');
  expect(scroller.getAttribute('aria-label')).toBe('ColorRamp › Each Interpolation Space');
  expect(await audit(container)).not.toContain('scrollable-region-focusable');
});

test('a story that fits is not a tab stop, and becomes one when it grows past the trial', async () => {
  const { container, findByTestId } = render(<Story initial={0} />);
  await findByTestId('story');
  const scroller = scrollerOf(container);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  expect(scroller.hasAttribute('tabindex')).toBe(false);
  expect(scroller.hasAttribute('role')).toBe(false);

  grow();
  await waitFor(() => expect(scroller.tabIndex).toBe(0));
});
