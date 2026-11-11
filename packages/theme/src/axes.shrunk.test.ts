import { describe, expect, it } from 'vitest';
import { wzlAttr } from './axes';

describe('wzlAttr, shrunk counterexamples', () => {
  it('escapes a carriage return and a form feed, which end a CSS string as a newline does', () => {
    expect(wzlAttr('theme', '\r')).toBe("[data-wzl-theme='\\d ']");
    expect(wzlAttr('theme', 'a\fb')).toBe("[data-wzl-theme='a\\c b']");
    const el = document.createElement('div');
    el.setAttribute('data-wzl-theme', 'a\r\nb');
    expect(el.matches(wzlAttr('theme', 'a\r\nb'))).toBe(true);
  });
});
