import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import './AnnotationOverlay.many.browser.test.less';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { defineInstrument, Lab } from '@weasel-js/labkit';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

afterEach(cleanup);
beforeEach(async () => {
  await page.viewport(1000, 700);
});

const COUNT = 100;
const cells = Array.from({ length: COUNT }, () => ({ current: null as HTMLDivElement | null }));

const Grid = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Grid',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => (
    <div className="lk-many-lab-grid">
      {cells.map((ref, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list
        <div key={i} className="lk-many-lab-cell" ref={ref} />
      ))}
    </div>
  ),
  annotations: {
    targets: () => cells.map((ref, i) => ({ id: `cell:${i}`, ref, content: { w: 20, h: 20 } })),
  },
});

test(`${COUNT} targets mounted in one commit all take marks`, async () => {
  const errors: unknown[] = [];
  const onError = (e: ErrorEvent) => errors.push(e.error ?? e.message);
  window.addEventListener('error', onError);
  const consoleError = vi.spyOn(console, 'error');
  try {
    renderWithIcons(
      <div className="lk-many-lab-host">
        <Lab instruments={[Grid]} defaultInstrument="Grid" />
      </div>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Rectangle' }));
    await waitFor(() =>
      expect(document.querySelectorAll('.lk-annotate__input')).toHaveLength(COUNT),
    );
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const depth = consoleError.mock.calls.filter((c) => String(c[0]).includes('Maximum update'));
    expect(depth).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    window.removeEventListener('error', onError);
    consoleError.mockRestore();
  }
});
