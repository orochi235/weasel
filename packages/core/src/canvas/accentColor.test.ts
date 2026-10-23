import { describe, it, expect } from 'vitest';
import { chromeColorOf } from './accentColor';

describe('chromeColorOf', () => {
  it('reads a custom property off the element, where a theme or a consumer sets it', () => {
    const el = document.createElement('div');
    el.style.setProperty('--wzl-entered-group', '#123456');
    document.body.append(el);
    expect(chromeColorOf(el, '--wzl-entered-group', '#000000')).toBe('#123456');
    el.remove();
  });

  it('answers the fallback where the property is unset or there is no element', () => {
    const el = document.createElement('div');
    document.body.append(el);
    expect(chromeColorOf(el, '--wzl-entered-group', '#000000')).toBe('#000000');
    expect(chromeColorOf(null, '--wzl-entered-group', '#000000')).toBe('#000000');
    el.remove();
  });
});
