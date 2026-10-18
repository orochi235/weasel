import '@weasel-js/theme/tokens.css';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { drag, type Point } from './pointerDrag.fixture';
import { renderWithIcons } from '../../testing/withIcons';

// A fragment draws no box, so a drop beside it is read off the rows inside it: the outer edge of its first row and
// of its last, past which a point is beside the fragment.

beforeAll(() => page.viewport(1600, 900));
afterEach(cleanup);

const leaf = (name: string) => ({ kind: 'boolean', name, description: '', default: false }) as const;
const START: PrefGroup = {
  name: 'Prefs',
  children: {
    view: {
      name: 'View',
      children: {
        a: leaf('Alpha'),
        pair: { name: 'Pair', as: 'fragment', children: { b: leaf('Beta'), c: leaf('Gamma') } },
        d: leaf('Delta'),
      },
    },
  },
};

let latest: PrefGroup = START;
function Live() {
  const [schema, setSchema] = useState(START);
  latest = schema;
  return <div style={{ height: 600 }}><PrefSchemaEditor schema={schema} onChange={setSchema} /></div>;
}

const preview = () => screen.getByRole('region', { name: 'Live preview' });
const label = (name: string) => within(preview()).getByText(name);
/**
 * A point on the row at `path`, `t` of the way along it from its leading edge (from its trailing edge where `t` is
 * negative), or `px` pixels in where `px` is given: down a column of rows, across where the form sets them two across.
 */
function along(path: string, t: number, px?: number): Point {
  const r = preview().querySelector(`[data-pref-path="${path}"]`)!.getBoundingClientRect();
  const across = preview().querySelector('[data-across="2"]') !== null;
  const [start, size] = across ? [r.left, r.width] : [r.top, r.height];
  const d = px ?? Math.abs(t) * size;
  const at = t >= 0 ? start + d : start + size - d;
  return across ? { x: at, y: r.top + r.height / 2 } : { x: r.left + r.width / 2, y: at };
}
const view = () => latest.children.view as PrefGroup;
const keys = () => Object.keys(view().children);
const inPair = () => Object.keys((view().children.pair as PrefGroup).children);

test('a row dropped at the leading edge of a fragment\'s first row lands before the fragment', () => {
  renderWithIcons(<Live />);
  drag(label('Delta'), along('view.pair.b', 1, 2));
  expect(keys()).toEqual(['a', 'd', 'pair']);
  expect(inPair()).toEqual(['b', 'c']);
});

test('a row dropped past that edge, in the first half of the row, lands before the row inside the fragment', () => {
  renderWithIcons(<Live />);
  drag(label('Delta'), along('view.pair.b', 0.4));
  expect(keys()).toEqual(['a', 'pair']);
  expect(inPair()).toEqual(['d', 'b', 'c']);
});

test('a row dropped at the trailing edge of a fragment\'s last row lands after the fragment', () => {
  renderWithIcons(<Live />);
  drag(label('Alpha'), along('view.pair.c', -1, 2));
  expect(keys()).toEqual(['pair', 'a', 'd']);
  expect(inPair()).toEqual(['b', 'c']);
});

test('a row dropped in the second half of a fragment\'s last row, short of its edge, lands after that row', () => {
  renderWithIcons(<Live />);
  drag(label('Alpha'), along('view.pair.c', -0.4));
  expect(keys()).toEqual(['pair', 'd']);
  expect(inPair()).toEqual(['b', 'c', 'a']);
});
