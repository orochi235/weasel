import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test } from 'vitest';
import { PrefsDialog } from './PrefsDialog';
import type { PrefGroup, PrefLeaf } from './schema';

// The modal sets only `max-height`, so a percentage height inside it resolves
// against nothing; only real layout shows whether the pane is the box that scrolls.

afterEach(cleanup);

const rows = (prefix: string, n: number): Record<string, PrefLeaf> =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [
      `${prefix}${i}`,
      { kind: 'boolean', name: `${prefix} ${i}`, description: 'A setting.', default: false },
    ]),
  );

const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      children: {
        grid: { name: 'Grid', children: rows('grid', 30) },
        snapping: { name: 'Snapping', children: rows('snap', 30) },
        export: { name: 'Export', children: rows('export', 30) },
      },
    },
  },
};

function pane(): HTMLElement {
  const title = screen.getByRole('heading', { level: 3, name: 'Canvas' });
  return title.parentElement!.parentElement!;
}

test('with no consumer height, the rail pane is capped by the modal and scrolls to a subentry', async () => {
  render(
    <PrefsDialog isOpen onOpenChange={() => {}} schema={SCHEMA} values={{}} onChange={() => {}} layout="rail" />,
  );
  const el = pane();
  expect(el.clientHeight).toBeGreaterThan(0);
  expect(el.clientHeight).toBeLessThan(window.innerHeight);
  expect(el.scrollHeight).toBeGreaterThan(el.clientHeight);

  expect(el.scrollTop).toBe(0);
  await userEvent.click(screen.getByRole('button', { name: 'Export' }));
  await expect.poll(() => el.scrollTop, { timeout: 2000 }).toBeGreaterThan(0);
});

test('tall content grows the modal to its max-height, not only to the settled minimum', () => {
  render(
    <PrefsDialog isOpen onOpenChange={() => {}} schema={SCHEMA} values={{}} onChange={() => {}} layout="rail" />,
  );
  const modal = screen.getByRole('dialog').parentElement!;
  expect(modal.clientHeight).toBe(window.innerHeight - 32);
});

test('a consumer height on the modal still decides the pane', () => {
  const sheet = document.createElement('style');
  sheet.textContent = '.consumer-height { block-size: 600px; }';
  document.head.append(sheet);
  try {
    render(
      <PrefsDialog
        isOpen
        onOpenChange={() => {}}
        schema={SCHEMA}
        values={{}}
        onChange={() => {}}
        layout="rail"
        dialogClassName="consumer-height"
      />,
    );
    const modal = screen.getByRole('dialog').parentElement!;
    expect(modal.clientHeight).toBe(600);
    const el = pane();
    expect(el.getBoundingClientRect().bottom).toBeLessThanOrEqual(modal.getBoundingClientRect().bottom);
    expect(el.scrollHeight).toBeGreaterThan(el.clientHeight);
  } finally {
    sheet.remove();
  }
});

test('a nested rail entry steps down from the color of the entry it sits in', () => {
  const schema: PrefGroup = {
    name: 'Preferences',
    children: { ...SCHEMA.children, text: { name: 'Text', children: rows('text', 2) } },
  };
  render(
    <PrefsDialog isOpen onOpenChange={() => {}} schema={schema} values={{}} onChange={() => {}} layout="rail" />,
  );
  const entry = (name: string) => screen.getByRole('button', { name });
  const nameColor = (name: string) => getComputedStyle(entry(name).querySelector('span')!).color;
  expect(entry('Snapping')).not.toHaveAttribute('aria-current');
  expect(entry('Text')).not.toHaveAttribute('aria-current');
  expect(nameColor('Text')).toBe(getComputedStyle(entry('Text')).color);
  const channels = (css: string) => css.match(/[\d.]+/g)!.map(Number);
  // The entry's color serializes as rgb(0–255); the stepped-down name as color(srgb 0–1 / alpha).
  const [r, g, b, alpha] = channels(nameColor('Snapping').replace('srgb', ''));
  const parent = channels(getComputedStyle(entry('Snapping')).color);
  [r, g, b].forEach((c, i) => expect(c * 255).toBeCloseTo(parent[i], 0));
  expect(alpha).toBeLessThan(1);
});
