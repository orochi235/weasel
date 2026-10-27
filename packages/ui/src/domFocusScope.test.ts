import { afterEach, describe, expect, it, vi } from 'vitest';
import { domFocusScope } from './domFocusScope';

afterEach(() => { document.body.innerHTML = ''; });

const mount = (html: string) => {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  const el = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
  return { root, el, scope: domFocusScope(root) };
};

describe('domFocusScope', () => {
  it('orders a positive tabindex first, then document order, skipping what Tab skips', () => {
    const { scope } = mount(`
      <button id="a">a</button><button id="b" tabindex="2">b</button><button id="off" disabled>x</button>
      <div id="c" tabindex="0">c</div><button id="d" tabindex="1">d</button><button id="neg" tabindex="-1">x</button>
      <div hidden><button id="h">x</button></div><input id="e">`);
    expect(scope.tabOrder().map((e) => e.id)).toEqual(['d', 'b', 'a', 'c', 'e']);
  });

  it('focuses and blurs elements inside it, and refuses ones outside', () => {
    const { el, scope } = mount('<button id="a">a</button>');
    const outside = document.createElement('button');
    document.body.append(outside);
    expect(scope.focus(el('a'))).toBe(true);
    expect(scope.focused).toBe(el('a'));
    expect(scope.focus(outside)).toBe(false);
    expect(scope.focused).toBe(el('a'));
    scope.focus(null);
    expect(scope.focused).toBeNull();
  });

  it('moves through the tab order and runs off either end, as a HUD does', () => {
    const { el, scope } = mount('<button id="a">a</button><button id="b">b</button>');
    expect(scope.moveFocus('next')).toBe(el('a'));
    expect(scope.moveFocus('next')).toBe(el('b'));
    expect(scope.moveFocus('next')).toBeNull();
    expect(scope.focused).toBeNull();
    expect(scope.moveFocus('prev')).toBe(el('b'));
  });

  it('steps from where an element out of the tab order sits', () => {
    const { el, scope } = mount('<button id="a">a</button><div id="x" tabindex="-1">x</div><button id="b">b</button>');
    scope.focus(el('x'));
    expect(scope.moveFocus('next')).toBe(el('b'));
    scope.focus(el('x'));
    expect(scope.moveFocus('prev')).toBe(el('a'));
  });

  it('tells a subscriber what took focus, and null when focus leaves', () => {
    const { el, scope } = mount('<button id="a">a</button>');
    const outside = document.createElement('button');
    document.body.append(outside);
    const fn = vi.fn();
    const off = scope.subscribeFocus(fn);
    el('a').focus();
    outside.focus();
    off();
    el('a').focus();
    expect(fn.mock.calls).toEqual([[el('a')], [null]]);
  });
});
