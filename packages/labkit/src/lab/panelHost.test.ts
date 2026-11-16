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
});
