import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import './TrialBody.narrow.browser.test.less';
import { cleanup, render } from '@testing-library/react';
import { TrialBody } from '@weasel-js/labkit';
import { afterEach, expect, test } from 'vitest';

// Where the strip lays its panes out on the frame it first paints is a layout question, and only a browser lays out.

afterEach(cleanup);

/** Each frame's reading, from the first frame callback after mount until the content pane exists: a frame callback
 *  runs ahead of that frame's paint, so the last reading is the first frame the content is painted on. */
async function untilContent(): Promise<{ strip: DOMRect; content: DOMRect; frames: number }> {
  for (let frames = 1; frames <= 60; frames++) {
    const found = await new Promise<{ strip: DOMRect; content: DOMRect } | null>((done) =>
      requestAnimationFrame(() => {
        const strip = document.querySelector('.lk-trial__panes');
        const content = document.querySelector('.lk-trial__content');
        done(
          strip && content
            ? { strip: strip.getBoundingClientRect(), content: content.getBoundingClientRect() }
            : null,
        );
      }),
    );
    if (found) return { ...found, frames };
  }
  throw new Error('the content pane never mounted');
}

test('a strip narrower than its stored sidebar and the content floor keeps the content inside it from the first frame', async () => {
  render(
    <div className="lk-root lk-narrow-trial-host">
      <TrialBody width={140} sidebar={<div />}>
        <div />
      </TrialBody>
    </div>,
  );
  const { strip, content, frames } = await untilContent();
  const at = `frame ${frames}: strip ${strip.left}..${strip.right}, content ${content.left}..${content.right}`;
  expect(strip.width, at).toBeCloseTo(260, 0);
  expect(content.left, at).toBeGreaterThanOrEqual(strip.left - 0.5);
  expect(content.right, at).toBeLessThanOrEqual(strip.right + 0.5);
});
