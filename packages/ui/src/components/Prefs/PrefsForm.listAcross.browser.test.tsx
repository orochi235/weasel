import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { PrefsForm } from './PrefsForm';

beforeAll(() => page.viewport(1000, 600));
afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Selection',
  children: {
    label: { kind: 'string', name: 'Label', description: '', default: '' },
    size: {
      name: 'Size',
      children: {
        w: { kind: 'number', name: 'W', description: '', default: 20 },
        h: { kind: 'number', name: 'H', description: '', default: 15 },
      },
    },
  },
};

const top = (c: HTMLElement, path: string) => c.querySelector(`[data-pref-path="${path}"]`)!.getBoundingClientRect();

it('sets a sidebar-wide list two rows across, a group running the full width', async () => {
  const { container } = render(
    <div style={{ width: 320 }}>
      <PrefsForm schema={SCHEMA} values={{}} onChange={() => {}} layout="list" rowsAcross={2} />
    </div>,
  );
  await document.fonts.ready;
  const w = top(container, 'size.w'), h = top(container, 'size.h');
  expect(h.top).toBe(w.top);
  expect(h.left).toBeGreaterThan(w.right - 1);
  expect(top(container, 'size').width).toBeGreaterThan(300);
});

it('keeps a list one row across without it', async () => {
  const { container } = render(
    <div style={{ width: 320 }}>
      <PrefsForm schema={SCHEMA} values={{}} onChange={() => {}} layout="list" />
    </div>,
  );
  await document.fonts.ready;
  expect(top(container, 'size.h').top).toBeGreaterThan(top(container, 'size.w').bottom - 1);
});
