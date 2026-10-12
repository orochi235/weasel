import { cleanup, render } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { PrefsForm, type PrefRenderContext } from './PrefsForm';

afterEach(cleanup);

// A drop in flight restarts when the tree the form draws is a new object, so a caller passing `values` inline
// must not get a new tree each render. Seen here as the leaf a renderer is handed staying the same object.
it('hands a renderer the same leaf across renders that pass a new values object', () => {
  const seen: PrefLeaf[] = [];
  // An object leaf is copied when the form drops its hidden fields, so its identity follows the tree's.
  const renderers = { object: (ctx: PrefRenderContext) => (seen.push(ctx.pref), null) };
  const schema: PrefGroup = {
    name: '',
    children: { stroke: { kind: 'object', name: 'Stroke', description: '', default: {}, children: { width: { kind: 'number', name: 'Width', description: '', default: 1 } } } as PrefLeaf },
  };
  const { rerender } = render(<PrefsForm schema={schema} values={{}} onChange={() => {}} renderers={renderers} />);
  rerender(<PrefsForm schema={schema} values={{}} onChange={() => {}} renderers={renderers} />);
  expect(seen).toHaveLength(2);
  expect(seen[1]).toBe(seen[0]);
});
