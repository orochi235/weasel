import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { PrefsForm } from './PrefsForm';

// Where a spanning leaf's rows start against the two columns beside it is the browser's grid and flex layout.

beforeAll(() => page.viewport(1000, 700));
afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      children: {
        unit: { kind: 'string', name: 'Unit', description: '', default: 'px' },
        zoom: { kind: 'number', name: 'Zoom', description: '', default: 1 },
        grid: {
          kind: 'object',
          name: 'Grid',
          description: '',
          default: { size: 8, color: '#888888' },
          children: {
            size: { kind: 'number', name: 'Size', description: '', default: 8 },
            color: { kind: 'string', name: 'Color', description: '', default: '#888888' },
          },
        },
        guides: {
          kind: 'list',
          name: 'Guides',
          description: '',
          default: [10, 20],
          item: { kind: 'number', name: 'Guide', description: '', default: 0 },
        },
      },
    },
  },
};

const mount = async () => {
  const { container } = render(
    <div style={{ width: 620, height: 520, display: 'flex' }}>
      <PrefsForm schema={SCHEMA} onChange={() => {}} layout="rail" rowsAcross={2} />
    </div>,
  );
  await document.fonts.ready;
  const row = (path: string) => container.querySelector(`[data-pref-path="${path}"]`)!.firstElementChild!;
  return { label: (path: string) => row(path).firstElementChild!, control: (path: string) => row(path).lastElementChild! };
};
const left = (el: Element) => Math.round(el.getBoundingClientRect().left);
const right = (el: Element) => Math.round(el.getBoundingClientRect().right);

it('sets a spanning leaf\'s label in the first column and its control in the second', async () => {
  const { label, control } = await mount();
  for (const path of ['canvas.grid', 'canvas.guides']) {
    expect(left(label(path))).toBe(left(label('canvas.unit')));
    expect(left(control(path))).toBe(left(label('canvas.zoom')));
    expect(right(control(path))).toBe(right(control('canvas.zoom')));
  }
});
