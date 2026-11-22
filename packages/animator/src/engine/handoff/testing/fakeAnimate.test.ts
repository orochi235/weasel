import { describe, expect, it } from 'vitest';
import { setup } from './fakeAnimate';

const had = Object.getOwnPropertyDescriptor(document, 'timeline');

describe('fakeAnimate setup', () => {
  it('stands the document timeline where its frame clock is', () => {
    setup().step(40);
    expect((document as unknown as { timeline: { currentTime: number } }).timeline.currentTime).toBe(40);
  });

  it('leaves the document timeline as it found it for the next test', () => {
    expect(Object.getOwnPropertyDescriptor(document, 'timeline')).toEqual(had);
  });
});
