import '../../../../../apps/forge/labkitStyles';
import '../shell.css';
import './readouts.browser.test.css';
import { createMemoryAdapter } from '@weasel-js/labkit';
import { cleanup, waitFor } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { FrameSetup } from '../../frame/FrameController';
import { meta, story } from '../../story/define';
import type { IndexEntry } from '../../story/types';
import { Workshop } from '../Workshop';

// A real lens over a real story, with the production stylesheets: whether a readout's hit test reaches into a
// compared copy that the lens layer keeps from the pointer is a browser's question.

const setup: FrameSetup = {
  applyGlobals: (globals, target) => {
    target.root.dataset.wzlMode = String(globals.mode ?? 'light');
  },
};

beforeEach(async () => {
  await page.viewport(1100, 760);
});

afterEach(() => {
  cleanup();
  history.replaceState(null, '', location.pathname);
});

const entry: IndexEntry = { id: 'r--ink', title: 'R', name: 'Ink', exportName: 'Ink', file: '/r.stories.tsx' };
const module = {
  default: meta({ title: 'R' }),
  Ink: story({
    layout: 'fullscreen',
    render: () => (
      <div className="fg-readouts-test-story">
        <div className="fg-readouts-test-panel">
          <p className="fg-readouts-test-text">Ink on surface</p>
        </div>
      </div>
    ),
  }),
};

const mode = {
  label: 'Mode',
  default: 'light',
  options: [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ],
};

function press(target: Element, init: KeyboardEventInit) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
  target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, ...init }));
}

/** A key inside the Loupe keymap, opened by its leader for this one key. */
function loupeKey(body: Element, key: string) {
  press(body, { code: 'KeyL', key: 'l', altKey: true });
  press(body, { key });
}

it('reads Token and Contrast from a compared lens’s own copy, under the opposite mode', async () => {
  history.replaceState(null, '', `${location.pathname}#/r--ink`);
  const { container } = renderWithIcons(
    <div className="fg-readouts-test-workshop">
      <Workshop
        index={[entry]}
        frameUrl="/frame.html"
        config={{ globals: { mode } }}
        importers={{ '/r.stories.tsx': () => Promise.resolve(module as unknown as Record<string, unknown>) }}
        setup={setup}
        storage={createMemoryAdapter()}
      />
    </div>,
  );
  const text = await waitFor(() => {
    const host = container.querySelector<HTMLElement>('[data-fg-host]:not([data-fg-copy])');
    const el = host?.querySelector('.fg-readouts-test-text');
    if (!el || host?.hasAttribute('data-pending')) throw new Error('no story yet');
    return el;
  });

  await userEvent.hover(text);
  const body = container.querySelector('.lk-lab__body')!;
  loupeKey(body, 'l');
  await waitFor(() => expect(document.querySelector('.lk-lens-interior')).not.toBeNull());
  loupeKey(body, 'o');
  loupeKey(body, 't');
  loupeKey(body, 'c');

  await waitFor(() => expect(document.querySelector('.fg-lens-copy [data-fg-copy]:not([data-pending]) .fg-readouts-test-text')).not.toBeNull());
  // The story renders light, whose text is gray-900; the compared copy is dark, whose text is gray-100.
  await waitFor(() =>
    expect(document.querySelector('.fg-lens-token')?.textContent).toMatch(/^color ← --wzl-fg ← --wzl-gray-100 ← /),
  );
  await waitFor(() => expect(document.querySelector('.fg-lens-contrast')?.textContent).toMatch(/^\d+\.\d\d:1 · AA /));
  // No probe is left behind on the layer.
  expect(document.querySelector('.lk-lens-layer')?.hasAttribute('data-probe')).toBe(false);
});
