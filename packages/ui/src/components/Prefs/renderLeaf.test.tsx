import { render } from '@testing-library/react';
import type { PrefUnion } from '@weasel-js/prefs';
import { expect, it } from 'vitest';
import type { LeafContext } from '../PrefsSource/types';
import { renderLeaf, type LeafParts } from './renderLeaf';

const union: PrefUnion = {
  kind: 'union', name: 'Shape', description: '', tag: 'type', default: { type: 'box', side: 1 },
  variants: { box: { kind: 'object', name: 'Box', description: '', default: { side: 1 }, children: { side: { kind: 'number', name: 'Side', description: '', default: 1 } } } },
};

it("keeps a union's tag on what its variant's fields write through drafts, as through update", () => {
  const written: unknown[] = [];
  const writer: LeafContext['update'] = (fn) => { written.push(fn(undefined, undefined)); };
  const ctx = {
    path: 'shape', pref: union, value: { type: 'box', side: 1 }, mixed: false, unset: false, each: [],
    update: writer, setValue: () => {}, drafts: { update: writer, setValue: () => {} },
  } as unknown as LeafContext;
  let inner: LeafContext | undefined;
  const parts = { surface: 'form', object: (c: LeafContext) => { inner = c; return null; }, control: () => null } as unknown as LeafParts;
  render(<>{renderLeaf(ctx, parts)}</>);
  inner!.update(() => ({ side: 2 }));
  inner!.drafts!.update(() => ({ side: 3 }));
  expect(written).toEqual([{ side: 2, type: 'box' }, { side: 3, type: 'box' }]);
});
