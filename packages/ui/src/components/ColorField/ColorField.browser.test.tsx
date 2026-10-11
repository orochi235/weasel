import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { ColorField } from './ColorField';

afterEach(cleanup);

function readoutWidth(value: string): number {
  const { container } = render(<ColorField value={value} alpha onChange={() => {}} aria-label="Fill" />);
  const readout = container.querySelector('span[aria-hidden="true"]')!;
  expect(readout.textContent).toMatch(/^\d+%$/);
  const width = readout.getBoundingClientRect().width;
  cleanup();
  return width;
}

test('the opacity readout is as wide at 100% as at 5%, so the row after it holds still', () => {
  const full = readoutWidth('#112233ff');
  expect(full).toBeGreaterThan(0);
  expect(readoutWidth('#1122330d')).toBe(full);
  expect(readoutWidth('#112233fc')).toBe(full);
});
