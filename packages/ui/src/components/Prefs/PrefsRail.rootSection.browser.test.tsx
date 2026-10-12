import '@weasel-js/theme/tokens.css';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { PrefsForm } from './PrefsForm';

// Which section is in view, and where a scroll ends, are the browser's to say: jsdom lays nothing out.

beforeAll(() => page.viewport(900, 500));
afterEach(cleanup);

const flags = (prefix: string, n: number) =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [`f${i}`, { kind: 'boolean' as const, name: `${prefix} ${i}`, description: '', default: false }]),
  );
const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    ...flags('Loose', 12),
    tools: { name: 'Tools', as: 'section', children: flags('Tool', 30) },
    canvas: { name: 'Canvas', children: flags('Canvas', 4) },
    files: { name: 'Files', as: 'section', children: flags('File', 30) },
  },
};

const mount = (defaultSection?: string) => {
  const { container } = render(
    <div style={{ width: 820, height: 300, display: 'flex' }}>
      <PrefsForm layout="rail" schema={SCHEMA} values={{}} onChange={() => {}} defaultSection={defaultSection} />
    </div>,
  );
  const entry = (path: string) => container.querySelector<HTMLElement>(`[data-pref-rail="${path}"]`)!;
  const pane = () => container.querySelector<HTMLElement>('[data-pref-into]')!;
  const offset = (path: string): number =>
    pane().querySelector(`[data-spy-section="${path}"]`)!.getBoundingClientRect().top - pane().getBoundingClientRect().top;
  const marks = () => Object.fromEntries(
    [...container.querySelectorAll('[data-rail-mark]')].map((el) => [el.getAttribute('data-pref-rail'), el.getAttribute('data-rail-mark')]),
  );
  return { entry, pane, offset, marks };
};

it('marks the root\'s page alone above its first section, and the section in view once one is', async () => {
  const { pane, offset, marks } = mount();
  expect(marks()).toEqual({ '': 'current' });

  pane().scrollTop += offset('tools') + 4;
  await expect.poll(marks).toEqual({ '': 'open', tools: 'current' });

  pane().scrollTop += offset('files') + 4;
  await expect.poll(marks).toEqual({ '': 'open', files: 'current' });

  pane().scrollTop = 0;
  await expect.poll(marks).toEqual({ '': 'current' });
});

it('scrolls the root\'s page to a section from its entry', async () => {
  const { entry, pane, offset, marks } = mount();
  fireEvent.click(entry('files'));
  await expect.poll(() => Math.abs(offset('files')), { timeout: 3000 }).toBeLessThan(2);
  expect(pane().scrollTop).toBeGreaterThan(0);
  expect(marks()).toEqual({ '': 'open', files: 'current' });
});

it('opens the root\'s page and scrolls it to a section chosen from another page', async () => {
  const { entry, pane, offset, marks } = mount('canvas');
  expect(pane().getAttribute('data-pref-into')).toBe('canvas');
  fireEvent.click(entry('files'));
  await expect.poll(() => pane().getAttribute('data-pref-into')).toBe('');
  await expect.poll(() => Math.abs(offset('files')), { timeout: 3000 }).toBeLessThan(2);
  expect(marks()).toEqual({ '': 'open', files: 'current' });
});
