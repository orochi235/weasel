import { describe, it, expect, beforeEach } from 'vitest';
import { acquireKitContentHandlers, _resetKitContentHandlersForTests } from './registerKitHandlers';
import { getContentHandlers, _resetContentHandlersForTests } from './contentHandlers';

const kitImageCount = () =>
  getContentHandlers().filter((h) => h.id === 'kit:image').length;

describe('acquireKitContentHandlers (refcount)', () => {
  beforeEach(() => {
    _resetContentHandlersForTests();
    _resetKitContentHandlersForTests();
  });

  it('two acquires register exactly one kit:image entry', () => {
    acquireKitContentHandlers();
    acquireKitContentHandlers();
    expect(kitImageCount()).toBe(1);
  });

  it('registers the weasel-JSON clipboard handler alongside image/svg', () => {
    acquireKitContentHandlers();
    expect(getContentHandlers().map((h) => h.id)).toEqual([
      'kit:weasel-json', // priority -50 — runs before the other kit handlers
      'kit:svg',
      'kit:image',
    ]);
  });

  it('releasing the first acquire keeps the handler registered', () => {
    const releaseA = acquireKitContentHandlers();
    acquireKitContentHandlers();
    releaseA();
    expect(kitImageCount()).toBe(1);
  });

  it('releasing the last acquire removes the handler', () => {
    const releaseA = acquireKitContentHandlers();
    const releaseB = acquireKitContentHandlers();
    releaseA();
    releaseB();
    expect(kitImageCount()).toBe(0);
  });

  it('double-release of the same disposer is a no-op', () => {
    const releaseA = acquireKitContentHandlers();
    acquireKitContentHandlers();
    releaseA();
    releaseA(); // must not decrement the refcount again
    expect(kitImageCount()).toBe(1);
  });
});
