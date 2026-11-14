import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/faces.css';
import { cleanup, render, screen } from '@testing-library/react';
import { useLayoutEffect, useRef } from 'react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { Bar } from '@weasel-js/ui/components/Bar';
import { FitLabel } from '@weasel-js/ui/components/FitLabel';

// A ResizeObserver loop and the room a label has are both layout, which jsdom does not do.

beforeAll(() => document.fonts.load('16px Oswald'));

afterEach(cleanup);

const FORMS = [
  ['Alignment', 'Align', 'Al'],
  ['Distribution', 'Distrib', 'Di'],
  ['Spacing', 'Space', 'Sp'],
] as const;

const frames = (n = 3) =>
  new Promise<void>((done) => {
    const tick = (left: number): void => {
      if (left === 0) done();
      else requestAnimationFrame(() => tick(left - 1));
    };
    tick(n);
  });

/** A box whose own observer, deeper in the page than the bar, grows it in its callback a few times over. */
function Grower() {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    let calls = 0;
    const ro = new ResizeObserver(() => {
      if (calls++ < 4 && outer.current) outer.current.style.height = `${10 + calls * 10}px`;
    });
    ro.observe(inner.current!);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer}>
      <div ref={inner}>readout</div>
    </div>
  );
}

function Room({ width }: { width: number }) {
  return (
    <div style={{ width }}>
      <Bar label="Layout" fit>
        {FORMS.map((forms) => (
          <button key={forms[0]} type="button" aria-label={forms[0]}>
            <FitLabel forms={forms} />
          </button>
        ))}
      </Bar>
      <Grower />
    </div>
  );
}

const shown = () => FORMS.map((f) => screen.getByRole('button', { name: f[0] }).textContent);

async function watch(run: () => Promise<void>): Promise<string[]> {
  const errors: string[] = [];
  const onError = (e: ErrorEvent) => {
    errors.push(e.message);
    e.preventDefault();
  };
  window.addEventListener('error', onError);
  try {
    await run();
  } finally {
    window.removeEventListener('error', onError);
  }
  return errors;
}

test('a fitted bar whose parent a deeper observer resizes raises no ResizeObserver loop, and still fits', async () => {
  let rerender: ReturnType<typeof render>['rerender'] = () => {};
  const errors = await watch(async () => {
    ({ rerender } = render(<Room width={900} />));
    await frames();
    expect(shown()).toEqual(FORMS.map((f) => f[0]));
    rerender(<Room width={120} />);
    await frames();
    expect(shown()).toEqual(FORMS.map((f) => f[2]));
    rerender(<Room width={900} />);
    await frames();
    expect(shown()).toEqual(FORMS.map((f) => f[0]));
  });
  expect(errors).toEqual([]);
});

test('a fitted bar steps only as far as its room needs', async () => {
  const errors = await watch(async () => {
    const { rerender } = render(<Room width={900} />);
    await frames();
    const bar = screen.getByRole('toolbar', { name: 'Layout' });
    const last = screen.getByRole('button', { name: FORMS[2][0] }).getBoundingClientRect().right;
    rerender(<Room width={Math.floor(last - bar.getBoundingClientRect().left) - 10} />);
    await frames();
    expect(shown()).toEqual(FORMS.map((f) => f[1]));
    expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
  });
  expect(errors).toEqual([]);
});
