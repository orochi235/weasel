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
      'kit:text', // -110, last, so markup and node payloads in plain text go to the handlers above
    ]);
  });

  it('false keeps none', () => {
    expect(kitHandlersFor(false)).toEqual([]);
  });

  it('omit drops the ids named and keeps the rest', () => {
    expect(ids(kitHandlersFor({ omit: ['kit:text', 'kit:svg'] }))).toEqual(['kit:image', 'kit:weasel-json']);
  });
});
