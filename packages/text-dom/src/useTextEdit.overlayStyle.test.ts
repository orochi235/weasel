import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTextEdit } from './useTextEdit';
import { SMALL_CAPS_SCALE } from '@weasel-js/text';
import {
  makeHarness,
  getOverlay,
  appendChar,
  placeCaretAtChar,
  dispatchBeforeInput,
  makeTrackingHarness,
} from './testing/textEditHarness';

describe('useTextEdit', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('flattens pattern fills to a solid CSS color on the overlay', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getPaint: () => ({ fill: { paint: { kind: 'texture', texture: { id: 'test-tex' } } } } as const),
    };
    const { result } = renderHook(() => useTextEdit(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.color).toBe('rgb(0, 0, 0)');
  });

  it('uses solid fill color directly on the overlay', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getPaint: () => ({ fill: { paint: { kind: 'solid', color: '#ff0000' } } } as const),
    };
    const { result } = renderHook(() => useTextEdit(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.color).toBe('rgb(255, 0, 0)');
  });

  it('caretColor defaults to the node fill when it is solid', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getPaint: () => ({ fill: { paint: { kind: 'solid', color: '#3366cc' } } } as const),
    };
    const { result } = renderHook(() => useTextEdit(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.caretColor).toBe('rgb(51, 102, 204)');
  });

  it('honors an explicit caretColor override', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getStyle: () => ({ caretColor: '#ff00ff' }),
      getPaint: () => ({ fill: { paint: { kind: 'solid', color: '#000' } } } as const),
    };
    const { result } = renderHook(() => useTextEdit(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.caretColor).toBe('rgb(255, 0, 255)');
  });

  it('caretColor falls back to #000 when the node fill is a pattern', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getPaint: () => ({ fill: { paint: { kind: 'texture', texture: { id: 'test-tex' } } } } as const),
    };
    const { result } = renderHook(() => useTextEdit(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.caretColor).toBe('rgb(0, 0, 0)');
  });

  it('injects a default ::selection style derived from caret color', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getPaint: () => ({ fill: { paint: { kind: 'solid', color: '#3366cc' } } } as const),
    };
    const { result } = renderHook(() => useTextEdit(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    const klass = Array.from(overlay.classList).find((c) => c.startsWith('weasel-text-edit-'));
    const ours = Array.from(document.head.querySelectorAll('style')).find((s) =>
      s.textContent?.includes(`.${klass}::selection`),
    );
    expect(ours?.textContent).toContain('background: color-mix(in srgb, #3366cc 25%, transparent)');
  });

  it('skips ::selection injection when selectionBackground is "none"', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getStyle: () => ({ selectionBackground: 'none' }),
    };
    const before = document.head.querySelectorAll('style').length;
    const { result } = renderHook(() => useTextEdit(opts));
    act(() => result.current.startEdit('a'));
    expect(document.head.querySelectorAll('style').length).toBe(before);
  });

  it('injects a scoped ::selection style when selectionBackground is set, and removes it on teardown', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getStyle: () => ({ selectionBackground: '#ffeb3b', selectionColor: '#000' }),
    };
    const { result } = renderHook(() => useTextEdit(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    const klass = Array.from(overlay.classList).find((c) => c.startsWith('weasel-text-edit-'));
    expect(klass).toBeTruthy();
    const styleEls = Array.from(document.head.querySelectorAll('style'));
    const ours = styleEls.find((s) => s.textContent?.includes(`.${klass}::selection`));
    expect(ours).toBeTruthy();
    expect(ours?.textContent).toContain('background: #ffeb3b');
    expect(ours?.textContent).toContain('color: #000');
    act(() => result.current.cancelEdit());
    const after = Array.from(document.head.querySelectorAll('style'));
    expect(after.find((s) => s.textContent?.includes(`.${klass}::selection`))).toBeUndefined();
  });
});

describe('useTextEdit — letter-spacing on the overlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('applies the node-level letterSpacing to the overlay at zoom 1', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16, letterSpacing: 3 });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.letterSpacing).toBe('3px');
  });

  it('scales the node-level letterSpacing by the world→screen factor', () => {
    // pose.fontSize 32 against style.fontSize 16 → zoom 2.
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16, letterSpacing: 3 }, 32);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.letterSpacing).toBe('6px');
  });

  it('applies zero tracking when the style omits letterSpacing', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16 }, 32);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.letterSpacing).toBe('0px');
  });

  it('lets a run-level letterSpacing replace the overlay value rather than add to it', () => {
    // CSS `letter-spacing` is inherited, and a child's own declaration
    // *replaces* the inherited value — it is not additive. So the run span
    // must carry the run's own world value, untouched by the node's.
    const h = makeTrackingHarness(
      [{ text: 'a' }, { text: 'b', letterSpacing: 2 }],
      { fontSize: 16, letterSpacing: 3 },
    );
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    const spans = overlay.querySelectorAll('span[data-run]');
    expect(overlay.style.letterSpacing).toBe('3px');
    expect((spans[0] as HTMLSpanElement).style.letterSpacing).toBe('');
    expect((spans[1] as HTMLSpanElement).style.letterSpacing).toBe('2px');
  });
});

describe('useTextEdit — alignment on the overlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('justifies, setting the last line at the start edge the canvas uses', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16, align: 'justify', direction: 'rtl' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.textAlign).toBe('justify');
    expect(overlay.style.getPropertyValue('text-align-last')).toBe('right');
  });

  it('leaves the last line to text-align when not justifying', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16, align: 'end', direction: 'ltr' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.textAlign).toBe('right');
    expect(overlay.style.getPropertyValue('text-align-last')).toBe('');
  });

  // Proxies, all three: what a browser does with these properties is layout,
  // which jsdom does not have.
  it('states the tab size the canvas lays out with', () => {
    const h = makeTrackingHarness([{ text: 'a\tb' }], { fontSize: 16, tabSize: 4 });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.getPropertyValue('tab-size')).toBe('4');
  });

  it('states the direction the canvas analyzes with', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16, direction: 'rtl' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.direction).toBe('rtl');
    expect(overlay.style.getPropertyValue('unicode-bidi')).toBe('');
  });

  it("states the text's language, which the browser's text-transform reads", () => {
    const h = makeTrackingHarness([{ text: 'istanbul' }], { fontSize: 16, lang: 'tr', textTransform: 'uppercase' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.getAttribute('lang')).toBe('tr');
  });

  it('states no language when the style has none', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16 });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.hasAttribute('lang')).toBe(false);
  });

  it('lets each paragraph find its own direction when the style states none', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16 });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.direction).toBe('');
    expect(overlay.style.getPropertyValue('unicode-bidi')).toBe('plaintext');
  });

  it('leaves a reading-order alignment to the browser when the direction is the text\'s', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16, align: 'end' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.textAlign).toBe('end');
    act(() => result.current.cancelEdit());

    const j = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16, align: 'justify' });
    const second = renderHook(() => useTextEdit(j.opts));
    act(() => second.result.current.startEdit('a'));
    const overlay = getOverlay(j.container)!;
    expect(overlay.style.textAlign).toBe('justify');
    expect(overlay.style.getPropertyValue('text-align-last')).toBe('start');
  });
});

describe('useTextEdit — node-level decoration on the overlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('carries node-level underline / strikethrough onto the overlay', () => {
    const h = makeTrackingHarness(
      [{ text: 'abc' }],
      { fontSize: 16, underline: true, strikethrough: true },
    );
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.textDecoration).toBe('underline line-through');
  });

  it('carries node-level overline onto the overlay', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16, overline: true, underline: true });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.textDecoration).toBe('underline overline');
  });

  it('sets a node-level script smaller and raised, on the line the plain text would hold', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16, script: 'super' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(parseFloat(overlay.style.fontSize)).toBeCloseTo(16 * 0.583, 3);
    // The line keeps the unscripted size's height, as the canvas's does.
    expect(parseFloat(overlay.style.lineHeight)).toBeCloseTo(16 * 1.2, 3);
    expect(overlay.style.top).toBe('-5.328px');
    // Node styling, so it must not come back as run styling.
    appendChar(overlay, 'd');
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'abcd' }]);
  });

  it("carries the node's text-transform onto the overlay", () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16, textTransform: 'uppercase' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.textTransform).toBe('uppercase');
    // Inherited by every run span, so it must not come back as run styling.
    appendChar(getOverlay(h.container)!, 'd');
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'abcd' }]);
  });

  it("sets the node's small caps in pieces at the canvas scale, and commits the source text", () => {
    const h = makeTrackingHarness([{ text: 'Abc' }], { fontSize: 16, fontVariantCaps: 'small-caps' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.fontVariant).toBe('small-caps');
    expect(overlay.style.getPropertyValue('--weasel-small-caps')).toBe(String(SMALL_CAPS_SCALE));
    expect(overlay.querySelector('[data-small-caps]')?.textContent).toBe('bc');
    appendChar(overlay, 'd');
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'Abcd' }]);
  });

  it('splits a plain node with small caps too, so its lowercase is sized', () => {
    const h = makeHarness({ a: 'Abc' });
    h.opts.getStyle = () => ({ fontSize: 16, fontVariantCaps: 'small-caps' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.querySelector('[data-small-caps]')?.textContent).toBe('bc');
  });

  it('moves a typed letter into the piece its case belongs in, keeping the caret after it', () => {
    const h = makeTrackingHarness([{ text: 'ab', fontVariantCaps: 'small-caps' }], { fontSize: 16 });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    placeCaretAtChar(overlay, 1);
    act(() => dispatchBeforeInput(overlay, 'X'));
    const span = overlay.querySelector('span[data-run]')!;
    expect([...span.childNodes].map((n) => n.textContent)).toEqual(['a', 'X', 'b']);
    act(() => dispatchBeforeInput(overlay, 'Y'));
    expect(span.textContent).toBe('aXYb');
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'aXYb', fontVariantCaps: 'small-caps' }]);
  });

  it('sets text-decoration: none on an undecorated node', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16 });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.textDecoration).toBe('none');
  });

  it('does not read its own node-level decoration back as a run flag', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16, underline: true });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    appendChar(getOverlay(h.container)!, 'd');
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'abcd' }]);
  });
});
