import { describe, expect, it } from 'vitest';
import { createStoryHosts } from './storyHosts';

describe('createStoryHosts', () => {
  it('hands out one ref per attached trial, holding its host', () => {
    const hosts = createStoryHosts();
    const host = document.createElement('div');
    const ref = hosts.ref('t1');
    const detach = hosts.attach('t1', host);
    expect(hosts.ref('t1')).toBe(ref);
    expect(ref.current).toBe(host);
    detach();
    expect(ref.current).toBeNull();
  });

  it('lets a trial go once its host detaches, and a ref held past that still reads a later host', () => {
    const hosts = createStoryHosts();
    const first = document.createElement('div');
    const held = hosts.ref('t1');
    hosts.attach('t1', first)();
    expect(hosts.ref('t1')).not.toBe(held);
    const second = document.createElement('div');
    hosts.attach('t1', second);
    expect(held.current).toBe(second);
  });

  it('keeps a later attach standing when an earlier one detaches', () => {
    const hosts = createStoryHosts();
    const a = document.createElement('div');
    const b = document.createElement('div');
    const detachA = hosts.attach('t1', a);
    hosts.attach('t1', b);
    detachA();
    expect(hosts.ref('t1').current).toBe(b);
  });
});
