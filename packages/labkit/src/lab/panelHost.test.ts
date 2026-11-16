import { describe, expect, it } from 'vitest';
import { createPanelHostRegistry } from './panelHost';

describe('createPanelHostRegistry', () => {
  it('notifies nobody when a key is set to the host it holds, or cleared when it holds none', () => {
    const hosts = createPanelHostRegistry();
    const el = document.createElement('div');
    let calls = 0;
    hosts.subscribe(() => {
      calls++;
    });
    hosts.set('a', null);
    hosts.set('a', el);
    hosts.set('a', el);
    expect(calls).toBe(1);
    hosts.set('a', null);
    hosts.set('a', null);
    expect(calls).toBe(2);
    expect(hosts.get('a')).toBeNull();
  });

  it('reflects each key and its host, a new host for a key replacing the old', () => {
    const hosts = createPanelHostRegistry();
    const a = document.createElement('div');
    const b = document.createElement('div');
    hosts.set('x', a);
    hosts.set('y', a);
    hosts.set('x', b);
    expect(hosts.reflection.entries().map((e) => [e.key, e.value, e.shadowed.length])).toEqual([
      ['x', b, 0],
      ['y', a, 0],
    ]);
  });
});
