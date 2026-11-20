import { stubColorScheme } from '@weasel-js/react/testing/stubMatchMedia';
import { describe, it, expect, vi } from 'vitest';
import { chromeColorOf, watchThemeOf } from './accentColor';

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

describe('watchThemeOf', () => {
  it('hears a theme or mode attribute change on the element or any element above it, until stopped', async () => {
    const outer = document.createElement('div');
    const el = document.createElement('div');
    outer.append(el);
    document.body.append(outer);
    const fn = vi.fn();
    const stop = watchThemeOf(() => el, fn);
    outer.setAttribute('data-wzl-mode', 'dark');
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);
    el.setAttribute('data-unrelated', 'x');
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);
    stop();
    outer.setAttribute('data-wzl-mode', 'light');
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);
    outer.remove();
  });

  it('hears the system color scheme flip, until stopped', () => {
    const flip = stubColorScheme('dark');
    const fn = vi.fn();
    const stop = watchThemeOf(() => null, fn);
    flip('light');
    expect(fn).toHaveBeenCalledTimes(1);
    stop();
    expect(flip.listeners.size).toBe(0);
    vi.unstubAllGlobals();
  });

  it('hears a custom property set inline above the element, and not an inline style that sets none', async () => {
    const outer = document.createElement('div');
    const el = document.createElement('div');
    outer.append(el);
    document.body.append(outer);
    const fn = vi.fn();
    const stop = watchThemeOf(() => el, fn);
    outer.style.setProperty('--wzl-accent', '#ff0000');
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);
    outer.style.transform = 'translate(4px, 0px)';
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);
    outer.style.setProperty('--wzl-accent', '#00ff00');
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(2);
    stop();
    outer.remove();
  });

  it('hears a stylesheet in the head added, rewritten or removed', async () => {
    const fn = vi.fn();
    const stop = watchThemeOf(() => null, fn);
    const sheet = document.createElement('style');
    document.head.append(sheet);
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);
    sheet.textContent = ':root { --wzl-accent: #f00; }';
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(2);
    document.head.append(document.createElement('meta'));
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(2);
    sheet.media = 'print';
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(3);
    sheet.remove();
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(4);
    stop();
    document.head.querySelectorAll('meta').forEach((m) => m.remove());
  });
});
