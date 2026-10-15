import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { KeyBank } from './KeyBank';
import { KeyCap } from './Keycap';

afterEach(cleanup);

const KEY = { width: 'calc(1.4 * var(--wzl-control-h-xs))', minWidth: 0, padding: '0 2px' };

function sizes(container: HTMLElement): Record<string, number> {
  const out: Record<string, number> = {};
  for (const kbd of container.querySelectorAll('kbd')) out[kbd.textContent!] = parseFloat(getComputedStyle(kbd).fontSize);
  return out;
}

test('Ins, Home, and End print at one size, small enough for the widest', async () => {
  const { container } = render(
    <>
      <KeyCap label="Home" />
      <KeyBank>
        {['Insert', 'Home', 'End'].map((k) => <KeyCap key={k} label={k} style={KEY} />)}
      </KeyBank>
    </>,
  );
  await document.fonts.ready;
  const [loose, ...banked] = [...container.querySelectorAll('kbd')];
  expect(banked.map((k) => k.textContent)).toEqual(['Ins', 'Home', 'End']);
  const px = banked.map((k) => parseFloat(getComputedStyle(k).fontSize));
  expect(px[0]).toBeLessThan(parseFloat(getComputedStyle(loose!).fontSize));
  expect(new Set(px).size).toBe(1);
  const home = banked[1]!;
  expect(home.scrollWidth).toBeLessThanOrEqual(home.clientWidth);
});

test('a key on a two-line spelling sizes itself; the rest still share one size', async () => {
  const { container } = render(
    <KeyBank wrap>
      {['Insert', 'Home', 'PgUp'].map((k) => <KeyCap key={k} label={k} style={KEY} />)}
    </KeyBank>,
  );
  await document.fonts.ready;
  const px = sizes(container);
  expect(Object.keys(px)).toEqual(['Ins', 'Home', 'Pg\nUp']);
  expect(px['Ins']).toBe(px['Home']);
  expect(container.querySelector('kbd[data-wrapped]')?.textContent).toBe('Pg\nUp');
});

test('with wrap off, no key prints two lines', async () => {
  const { container } = render(
    <KeyBank>
      {['PgUp', 'PgDn', 'Backspace'].map((k) => <KeyCap key={k} label={k} style={KEY} />)}
    </KeyBank>,
  );
  await document.fonts.ready;
  expect(container.querySelector('kbd[data-wrapped]')).toBeNull();
  expect(Object.keys(sizes(container)).some((l) => l.includes('\n'))).toBe(false);
});
