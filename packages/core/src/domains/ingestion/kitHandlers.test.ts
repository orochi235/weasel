import { describe, it, expect } from 'vitest';
import { handlersFor } from './contentHandlers';
import { kitHandlersFor } from './kitHandlers';

const ids = (handlers: readonly { id: string }[]) => handlers.map((h) => h.id);

describe('kitHandlersFor', () => {
  it('keeps every kit handler by default, in the order they run', () => {
    expect(ids(handlersFor(kitHandlersFor()))).toEqual([
      'kit:weasel-json', // priority -50 — runs before the other kit handlers
      'kit:svg',
      'kit:image',
    ]);
  });

  it('false keeps none', () => {
    expect(kitHandlersFor(false)).toEqual([]);
  });

  it('omit drops the ids named and keeps the rest', () => {
    expect(ids(kitHandlersFor({ omit: ['kit:image', 'kit:svg'] }))).toEqual(['kit:weasel-json']);
  });
});
