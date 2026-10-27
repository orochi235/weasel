import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UNKNOWN_MIME } from '@weasel-js/gestures';
import type { IngestItem } from '@weasel-js/routing';
import { ingestAction } from 'interactions/actions/defaults/ingest';
import { couldClaim, registerContentHandler, _resetContentHandlersForTests } from './contentHandlers';

const png: IngestItem = { kind: 'file', mime: 'image/png', file: new File(['x'], 'a.png', { type: 'image/png' }) };
const txt: IngestItem = { kind: 'string', mime: 'text/plain', text: 'hi' };
/** An item as a drag in flight reports it: its MIME and nothing else. */
const hovering = (mime: string) => ({ mime }) as unknown as IngestItem;

beforeEach(() => _resetContentHandlersForTests());
afterEach(() => vi.restoreAllMocks());

describe('couldClaim', () => {
  it('asks each handler about an item it can read', () => {
    registerContentHandler({ id: 'img', match: 'image/*', handle: () => {} });
    registerContentHandler({ id: 'svg', match: (it) => it.kind === 'string' && it.text.startsWith('<svg'), handle: () => {} });
    expect(couldClaim([png])).toBe(true);
    expect(couldClaim([txt])).toBe(false);
    expect(couldClaim([txt, png])).toBe(true);
  });

  it('answers a hovering item from globs and declared types, never by running a predicate', () => {
    const match = vi.fn(() => true);
    registerContentHandler({ id: 'img', match: 'image/*', handle: () => {} });
    registerContentHandler({ id: 'svg', match, types: ['text/plain'], handle: () => {} });
    expect(couldClaim([hovering('image/png')])).toBe(true);
    expect(couldClaim([hovering('text/plain')])).toBe(true);
    expect(couldClaim([hovering('application/pdf')])).toBe(false);
    expect(match).not.toHaveBeenCalled();
  });

  it('cannot refuse a hovering item while a predicate handler declares no types', () => {
    registerContentHandler({ id: 'any', match: () => false, handle: () => {} });
    expect(couldClaim([hovering('application/pdf')])).toBe(true);
  });

  it('cannot refuse a file the browser has not named yet', () => {
    registerContentHandler({ id: 'img', match: 'image/*', handle: () => {} });
    expect(couldClaim([hovering(UNKNOWN_MIME)])).toBe(true);
  });

  it('takes the handlers to ask in place of the registry', () => {
    registerContentHandler({ id: 'img', match: 'image/*', handle: () => {} });
    expect(couldClaim([png], [{ id: 'csv', match: 'text/csv', handle: () => {} }])).toBe(false);
  });
});

describe('ingestAction.enabled', () => {
  it('declines an event whose items no handler could claim, and takes one with no items', () => {
    registerContentHandler({ id: 'img', match: 'image/*', handle: () => {} });
    expect(ingestAction.enabled!({}, undefined, { items: [png] })).toBe(true);
    expect(ingestAction.enabled!({}, undefined, { items: [txt] })).not.toBe(true);
    expect(ingestAction.enabled!({}, undefined, { items: [hovering('application/pdf')] })).not.toBe(true);
    expect(ingestAction.enabled!({})).toBe(true);
  });
});
