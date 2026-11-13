import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import './AnnotationOverlay.many.browser.test.less';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { defineInstrument, Lab, useAnnotations } from '@weasel-js/labkit';
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
        <Lab instruments={[Grid]} />
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

const upper: { current: HTMLDivElement | null } = { current: null };
const lower: { current: HTMLDivElement | null } = { current: null };
const scroller: { current: HTMLDivElement | null } = { current: null };

function Targets() {
  const marks = useAnnotations().query();
  return <output data-testid="targets">{marks.map((m) => m.target).join(',')}</output>;
}

// Two targets stacked in a window one target tall: scrolled by one, the lower sits where the upper was.
const Stacked = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Stacked',
  initialState: () => ({}),
  render: () => (
    <>
      <div className="lk-many-lab-scroller" ref={scroller}>
        <div className="lk-many-lab-stacked" ref={upper} />
        <div className="lk-many-lab-stacked" ref={lower} />
      </div>
      <Targets />
    </>
  ),
  annotations: {
    targets: () => [
      { id: 'upper', ref: upper, content: { w: 300, h: 150 } },
      { id: 'lower', ref: lower, content: { w: 300, h: 150 } },
    ],
  },
});

const pointer = (type: string, x: number, y: number, buttons: number) =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons,
    clientX: x,
    clientY: y,
  });

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

test('a stroke begun in the frame a pane scrolls lands on the target now under it', async () => {
  renderWithIcons(
    <div className="lk-many-lab-host">
      <Lab instruments={[Stacked]} />
    </div>,
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Rectangle' }));
  await waitFor(() => expect(document.querySelectorAll('.lk-annotate__input')).toHaveLength(2));
  const el = scroller.current as HTMLElement;
  const box = el.getBoundingClientRect();
  const x = box.left + 60;
  const y = box.top + 40;
  await waitFor(() =>
    expect((document.elementFromPoint(x, y) as HTMLElement | null)?.dataset.annotationTarget).toBe(
      'upper',
    ),
  );

  // Pressed in a frame callback queued from the scroll event: the frame the scroll draws in, and
  // before any observer has reported it.
  expect(el.scrollHeight).toBeGreaterThan(el.clientHeight);
  const pressed = new Promise<HTMLElement>((resolve, reject) => {
    el.addEventListener(
      'scroll',
      () =>
        requestAnimationFrame(() => {
          const input = document.elementFromPoint(x, y);
          if (!(input instanceof HTMLElement)) {
            reject(new Error(`nothing to press at ${x},${y}: ${String(input)}`));
            return;
          }
          input.dispatchEvent(pointer('pointerdown', x, y, 1));
          resolve(input);
        }),
      { once: true },
    );
    setTimeout(() => reject(new Error(`no scroll event; scrollTop ${el.scrollTop}`)), 3000);
  });
  el.scrollTop = 150;
  const input = await pressed;
  expect(input.dataset.annotationTarget).toBe('lower');
  for (let i = 1; i <= 8; i++) {
    input.dispatchEvent(pointer('pointermove', x + 15 * i, y + 8 * i, 1));
    await nextFrame();
  }
  input.dispatchEvent(pointer('pointerup', x + 120, y + 64, 0));
  await waitFor(() => expect(screen.getByTestId('targets').textContent).toBe('lower'));
});
