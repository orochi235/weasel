import { describe, expect, it } from 'vitest';
import { containsComposed } from './elementAt';

describe('containsComposed', () => {
  it('counts an element in a shadow root as inside its host', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const inner = document.createElement('span');
    host.attachShadow({ mode: 'open' }).appendChild(inner);
    expect(containsComposed(document.body, inner)).toBe(true);
    host.remove();
  });

  it('answers false for a detached subtree topped by a link, whose host is a URL string', () => {
    const link = document.createElement('a');
    link.href = 'https://x.test/row';
    const inner = document.createElement('span');
    link.appendChild(inner);
    expect(containsComposed(document.body, inner)).toBe(false);
  });
});

describe('containsComposed, slotted content', () => {
  it('counts light content slotted into a shadow root as inside the element holding the slot', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const list = document.createElement('div');
    list.appendChild(document.createElement('slot'));
    host.attachShadow({ mode: 'open' }).appendChild(list);
    const item = host.appendChild(document.createElement('div'));
    const label = item.appendChild(document.createElement('span'));
    expect(containsComposed(list, item)).toBe(true);
    expect(containsComposed(list, label)).toBe(true);
    const aside = document.createElement('div');
    host.shadowRoot!.appendChild(aside);
    expect(containsComposed(aside, label)).toBe(false);
    host.remove();
  });
});
