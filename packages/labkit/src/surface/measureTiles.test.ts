import { afterEach, describe, expect, it } from 'vitest';
import { scopeHolds } from './measureTiles';

afterEach(() => {
  document.body.replaceChildren();
});

describe('scopeHolds', () => {
  it('holds a tile inside a shadow root below the scope', () => {
    const scope = document.createElement('div');
    const host = document.createElement('div');
    scope.append(host);
    document.body.append(scope);
    const tile = document.createElement('div');
    host.attachShadow({ mode: 'open' }).append(tile);
    expect(scopeHolds(scope, tile)).toBe(true);
    expect(scopeHolds([document.createElement('div'), scope], tile)).toBe(true);
  });

  it('holds a slotted tile inside the shadow-tree element its slot sits in', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const pane = document.createElement('div');
    pane.append(document.createElement('slot'));
    host.attachShadow({ mode: 'open' }).append(pane);
    const tile = document.createElement('div');
    host.append(tile);
    expect(scopeHolds(pane, tile)).toBe(true);
    expect(scopeHolds(host, tile)).toBe(true);
  });

  it('does not hold a tile outside it', () => {
    const scope = document.createElement('div');
    const tile = document.createElement('div');
    document.body.append(scope, tile);
    expect(scopeHolds(scope, tile)).toBe(false);
    expect(scopeHolds(null, tile)).toBe(true);
  });
});
