import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../../styles.less';
import { cleanup, waitFor } from '@testing-library/react';
import { defineInstrument, Lab } from '@weasel-js/labkit';
import { labLoupe, QUICK_TAP_MS } from '@weasel-js/labkit/loupe';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

// Whether a lens finds the trial under its reticle and copies it in is hit testing and layout: a browser's to answer.

afterEach(cleanup);
beforeEach(async () => {
  await page.viewport(1000, 700);
});

const Glyphs = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Glyphs',
  initialState: () => ({}),
  render: () => (
    <svg
      className="lk-loupe-test-art"
      viewBox="0 0 200 100"
      width="600"
      height="300"
      role="img"
      aria-label="art"
    >
      <text className="lk-loupe-test-probe" x="10" y="60">
        segmento
      </text>
    </svg>
  ),
});

function mount() {
  renderWithIcons(<Lab instruments={[Glyphs]} addTrial={false} labChrome={[labLoupe]} />);
}

test('a lab with labLoupe opens a lens on Alt+L, L that shows a copy of the trial under it', async () => {
  mount();
  const art = await waitFor(() => {
    const el = document.querySelector('.lk-trial__body .lk-loupe-test-art');
    expect(el).not.toBeNull();
    return el as Element;
  });
  const box = art.getBoundingClientRect();
  const text = art.querySelector('.lk-loupe-test-probe') as Element;
  const at = text.getBoundingClientRect();
  await userEvent.hover(text, { position: { x: at.width / 2, y: at.height / 2 } });
  await userEvent.keyboard('{Alt>}l{/Alt}l');
  await waitFor(() => {
    const copy = document.querySelector('.lk-lens-copy');
    expect(copy?.querySelector('.lk-trial__body .lk-loupe-test-probe')?.textContent).toBe(
      'segmento',
    );
  });
  // The copy is scaled up about the reticle, so it is larger than the trial it copies.
  const copy = document.querySelector('.lk-lens-copy .lk-loupe-test-art') as Element;
  expect(copy.getBoundingClientRect().width).toBeGreaterThan(box.width);
});

test('a lab without labLoupe has no lens layer', async () => {
  renderWithIcons(<Lab instruments={[Glyphs]} addTrial={false} />);
  await waitFor(() => expect(document.querySelector('.lk-loupe-test-art')).not.toBeNull());
  expect(document.querySelector('.lk-lens-layer')).toBeNull();
});

test('F2 opens a lens over the pointer, carries it while held, and a tap closes it', async () => {
  mount();
  const text = await waitFor(() => {
    const el = document.querySelector('.lk-trial__body .lk-loupe-test-probe');
    expect(el).not.toBeNull();
    return el as Element;
  });
  const at = text.getBoundingClientRect();
  await userEvent.hover(text, { position: { x: at.width / 2, y: at.height / 2 } });
  await userEvent.keyboard('{F2}');
  const lens = () => document.querySelector('.lk-lens-interior');
  const centerOf = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  await waitFor(() => expect(lens()).not.toBeNull());
  const opened = centerOf(lens()!);
  expect(opened.x).toBeCloseTo(at.left + at.width / 2, -1);
  expect(opened.y).toBeCloseTo(at.top + at.height / 2, -1);
  // Held, it follows the pointer; let go, it stays.
  await userEvent.keyboard('{F2>}');
  // The lens covers the pointer now, so the move lands on its body's hit box.
  const hit = document.querySelector('.lk-lens-hit[data-role="lens-body"]') as Element;
  const box = hit.getBoundingClientRect();
  await userEvent.hover(hit, { position: { x: box.width / 2 + 40, y: box.height / 2 } });
  await new Promise((r) => setTimeout(r, QUICK_TAP_MS));
  await userEvent.keyboard('{/F2}');
  await waitFor(() => expect(centerOf(lens()!).x).toBeCloseTo(opened.x + 40, -1));
  await userEvent.keyboard('{F2}');
  await waitFor(() => expect(lens()).toBeNull());
});
