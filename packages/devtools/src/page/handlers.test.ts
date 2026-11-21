/** What `answer` hands back for records that are plain data by contract: every item, however many. */
import { expect, it } from 'vitest';
import { answer } from './handlers';
import type { DevtoolsRoot } from './root';

const many = (n: number) => Array.from({ length: n }, (_, i) => ({ actionId: `a${i}`, routes: [], specificity: [0, 0, 0, 0] }));

function rootWith(record: unknown, frame: unknown): DevtoolsRoot {
  const ring = { since: () => ({ entries: [record], cursor: 1 }), live: () => null };
  return { source: { trace: ring, coords: ring, frame: () => frame } } as unknown as DevtoolsRoot;
}

it('hands back every candidate of a trace record, past the serializer default cap', () => {
  const root = rootWith({ matched: many(150) }, null);
  const slice = answer(root, { type: 'get-trace', cursor: 0 } as never, () => {}) as { entries: { matched: unknown[] }[] };
  expect(slice.entries[0]!.matched).toHaveLength(150);
  expect(slice.entries[0]!.matched.at(-1)).toMatchObject({ actionId: 'a149' });
});

