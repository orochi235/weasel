import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runsToDom, domToRuns, charOffsetToDomPosition, domPositionToCharOffset } from './domRuns';
import type { StyledRun } from './runs';

describe('runsToDom', () => {
  let parent: HTMLDivElement;
  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  it('emits one styled span per run with data-run marker', () => {
    const runs: StyledRun[] = [
      { text: 'plain ' },
      { text: 'bold', bold: true },
      { text: ' rest' },
    ];
    runsToDom(runs, parent);
    const spans = parent.querySelectorAll('span[data-run]');
    expect(spans).toHaveLength(3);
    expect(spans[0].textContent).toBe('plain ');
    expect(spans[1].textContent).toBe('bold');
    expect((spans[1] as HTMLSpanElement).style.fontWeight).toBe('700');
    expect(spans[2].textContent).toBe(' rest');
  });

  it('applies italic via inline font-style', () => {
    runsToDom([{ text: 'x', italic: true }], parent);
    const span = parent.querySelector('span[data-run]') as HTMLSpanElement;
    expect(span.style.fontStyle).toBe('italic');
  });

  it('applies bold+italic together', () => {
    runsToDom([{ text: 'x', bold: true, italic: true }], parent);
    const span = parent.querySelector('span[data-run]') as HTMLSpanElement;
    expect(span.style.fontWeight).toBe('700');
    expect(span.style.fontStyle).toBe('italic');
  });

  it('applies fontSize / fontFamily / fill overrides', () => {
    runsToDom([{
      text: 'x',
      fontSize: 24,
      fontFamily: 'mono',
      fill: { fill: 'solid', color: '#ff0000' },
    }], parent);
    const span = parent.querySelector('span[data-run]') as HTMLSpanElement;
    expect(span.style.fontSize).toBe('24px');
    expect(span.style.fontFamily).toBe('mono');
    expect(span.style.color).toBe('rgb(255, 0, 0)');
  });

  it('preserves embedded newlines as literal \\n inside textContent', () => {
    runsToDom([{ text: 'a\nb' }], parent);
    const span = parent.querySelector('span[data-run]') as HTMLSpanElement;
    expect(span.textContent).toBe('a\nb');
  });

  it('replaces existing children of the parent', () => {
    parent.innerHTML = '<p>old</p>';
    runsToDom([{ text: 'new' }], parent);
    expect(parent.querySelectorAll('p')).toHaveLength(0);
    expect(parent.querySelectorAll('span[data-run]')).toHaveLength(1);
  });

  it('renders decoration as inline style, not element wrappers', () => {
    runsToDom([{ text: 'a', underline: true, strikethrough: true }], parent);
    expect(parent.querySelector('u')).toBeNull();
    expect(parent.querySelector('s')).toBeNull();
    expect(parent.firstElementChild).toHaveStyle({ textDecoration: 'underline line-through' });
  });

  it('emits each decoration on its own', () => {
    runsToDom([{ text: 'u', underline: true }, { text: 's', strikethrough: true }], parent);
    const spans = parent.querySelectorAll('span[data-run]');
    expect((spans[0] as HTMLSpanElement).style.textDecoration).toBe('underline');
    expect((spans[1] as HTMLSpanElement).style.textDecoration).toBe('line-through');
  });

  it('leaves text-decoration unset on an undecorated run so the node style shows through', () => {
    runsToDom([{ text: 'a' }], parent);
    const span = parent.querySelector('span[data-run]') as HTMLSpanElement;
    expect(span.style.textDecoration).toBe('');
    expect(span.style.letterSpacing).toBe('');
  });

  it('emits letterSpacing in px', () => {
    runsToDom([{ text: 'a', letterSpacing: 2.5 }], parent);
    const span = parent.querySelector('span[data-run]') as HTMLSpanElement;
    expect(span.style.letterSpacing).toBe('2.5px');
  });

  it('emits an explicit letterSpacing: 0 override rather than dropping it', () => {
    runsToDom([{ text: 'a', letterSpacing: 0 }], parent);
    const span = parent.querySelector('span[data-run]') as HTMLSpanElement;
    expect(span.style.letterSpacing).toBe('0px');
  });

  it('emits negative tracking', () => {
    runsToDom([{ text: 'a', letterSpacing: -1 }], parent);
    const span = parent.querySelector('span[data-run]') as HTMLSpanElement;
    expect(span.style.letterSpacing).toBe('-1px');
  });
});

describe('domToRuns', () => {
  let parent: HTMLDivElement;
  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  it('returns runs from a freshly-built span sequence', () => {
    runsToDom([{ text: 'a ' }, { text: 'b', bold: true }, { text: ' c' }], parent);
    expect(domToRuns(parent)).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' c' },
    ]);
  });

  it('coalesces adjacent identical runs', () => {
    const s1 = document.createElement('span');
    s1.setAttribute('data-run', '');
    s1.style.fontWeight = '700';
    s1.textContent = 'a';
    const s2 = document.createElement('span');
    s2.setAttribute('data-run', '');
    s2.style.fontWeight = '700';
    s2.textContent = 'b';
    parent.append(s1, s2);
    expect(domToRuns(parent)).toEqual([{ text: 'ab', bold: true }]);
  });

  it('treats <br> as a newline character in the preceding run', () => {
    const s = document.createElement('span');
    s.setAttribute('data-run', '');
    s.textContent = 'a';
    parent.append(s, document.createElement('br'));
    const s2 = document.createElement('span');
    s2.setAttribute('data-run', '');
    s2.textContent = 'b';
    parent.append(s2);
    expect(domToRuns(parent)).toEqual([{ text: 'a\nb' }]);
  });

  it('treats <div> boundaries as newlines', () => {
    const d1 = document.createElement('div');
    d1.textContent = 'a';
    const d2 = document.createElement('div');
    d2.textContent = 'b';
    parent.append(d1, d2);
    expect(domToRuns(parent)).toEqual([{ text: 'a\nb' }]);
  });

  it('flattens nested <b> / <strong> / <i> / <em> into bold / italic flags', () => {
    parent.innerHTML = '<b>bold</b><i>it</i><strong>str</strong><em>em</em>';
    expect(domToRuns(parent)).toEqual([
      { text: 'bold', bold: true },
      { text: 'it', italic: true },
      { text: 'str', bold: true },
      { text: 'em', italic: true },
    ]);
  });

  it('returns empty array for empty parent', () => {
    expect(domToRuns(parent)).toEqual([]);
  });

  it('round-trips runsToDom → domToRuns', () => {
    const runs: StyledRun[] = [
      { text: 'plain ' },
      { text: 'bold', bold: true },
      { text: ' both ', italic: true, bold: true },
      { text: 'tail' },
    ];
    runsToDom(runs, parent);
    expect(domToRuns(parent)).toEqual(runs);
  });

  it('reads decoration back off inline text-decoration', () => {
    const span = document.createElement('span');
    span.setAttribute('data-run', '');
    span.style.textDecoration = 'underline line-through';
    span.textContent = 'x';
    parent.append(span);
    expect(domToRuns(parent)).toEqual([{ text: 'x', underline: true, strikethrough: true }]);
  });

  it('accumulates an ancestor decoration with a descendant one', () => {
    // `text-decoration` propagates rather than inherits: a descendant cannot
    // cancel what an ancestor drew, and a browser renders both lines here.
    // Reachable in the overlay — `runsToDom` emits the strikethrough span and
    // an unintercepted Cmd+U supplies the `<u>`.
    const u = document.createElement('u');
    const inner = document.createElement('span');
    inner.style.textDecoration = 'line-through';
    inner.textContent = 'st';
    u.append(inner);
    parent.append(u);
    expect(domToRuns(parent)).toEqual([{ text: 'st', underline: true, strikethrough: true }]);
  });

  it('does not let a descendant text-decoration: none cancel an ancestor decoration', () => {
    const outer = document.createElement('span');
    outer.style.textDecoration = 'underline';
    const inner = document.createElement('span');
    inner.style.textDecoration = 'none';
    inner.textContent = 'x';
    outer.append(inner);
    parent.append(outer);
    expect(domToRuns(parent)).toEqual([{ text: 'x', underline: true }]);
  });

  it('reads text-decoration-line when only the longhand is declared', () => {
    // A block carrying only the longhand serializes the shorthand as '' —
    // the shorthand needs the full set. Pasted HTML routinely looks like this.
    const span = document.createElement('span');
    span.setAttribute('style', 'text-decoration-line: underline line-through');
    span.textContent = 'x';
    parent.append(span);
    expect(domToRuns(parent)).toEqual([{ text: 'x', underline: true, strikethrough: true }]);
  });

  it('flattens <u> / <s> / <strike> wrappers into decoration flags', () => {
    // `<s>` and `<strike>` produce the same style, so they coalesce.
    parent.innerHTML = '<u>un</u><s>st</s><strike>rike</strike><u>u2</u>';
    expect(domToRuns(parent)).toEqual([
      { text: 'un', underline: true },
      { text: 'strike', strikethrough: true },
      { text: 'u2', underline: true },
    ]);
  });

  it('reads letterSpacing back as a number', () => {
    const span = document.createElement('span');
    span.setAttribute('data-run', '');
    span.style.letterSpacing = '3.5px';
    span.textContent = 'x';
    parent.append(span);
    expect(domToRuns(parent)).toEqual([{ text: 'x', letterSpacing: 3.5 }]);
  });

  it('warns on a non-px letter-spacing unit but still parses the numeric value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const span = document.createElement('span');
      span.setAttribute('style', 'letter-spacing: 0.1em');
      span.textContent = 'x';
      parent.append(span);
      expect(domToRuns(parent)).toEqual([{ text: 'x', letterSpacing: 0.1 }]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/letter-spacing.*em/);
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn on the px unit it emits itself', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      runsToDom([{ text: 'x', letterSpacing: 2 }], parent);
      expect(domToRuns(parent)).toEqual([{ text: 'x', letterSpacing: 2 }]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('treats letter-spacing: normal as clearing an inherited value', () => {
    const outer = document.createElement('span');
    outer.style.letterSpacing = '4px';
    const inner = document.createElement('span');
    inner.style.letterSpacing = 'normal';
    inner.textContent = 'x';
    outer.append(inner);
    parent.append(outer);
    expect(domToRuns(parent)).toEqual([{ text: 'x' }]);
  });

  it('ignores the overlay root\'s own letter-spacing (it is screen-scaled, not a run value)', () => {
    // `useTextEdit` sets the node-level tracking on the overlay itself in
    // *screen* px. Reading it back as a run-level value would both scale the
    // world value by the zoom and pin an inherited value onto every run.
    parent.style.letterSpacing = '8px';
    runsToDom([{ text: 'a' }], parent);
    expect(domToRuns(parent)).toEqual([{ text: 'a' }]);
  });

  it('does not coalesce runs that differ only in the new keys', () => {
    runsToDom([
      { text: 'a', underline: true },
      { text: 'b', strikethrough: true },
      { text: 'c', letterSpacing: 1 },
      { text: 'd', letterSpacing: 2 },
    ], parent);
    expect(domToRuns(parent)).toHaveLength(4);
  });
});

describe('domRuns round-trip — decoration and tracking', () => {
  let parent: HTMLDivElement;
  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  it('round-trips the new style keys', () => {
    const runs: StyledRun[] = [
      { text: 'a', underline: true },
      { text: 'b', strikethrough: true, letterSpacing: 2 },
    ];
    runsToDom(runs, parent);
    expect(domToRuns(parent)).toEqual(runs);
  });

  it('round-trips letterSpacing: 0 as an explicit override', () => {
    const runs: StyledRun[] = [{ text: 'a', letterSpacing: 0 }, { text: 'b', letterSpacing: 4 }];
    runsToDom(runs, parent);
    expect(domToRuns(parent)).toEqual(runs);
  });

  it('round-trips negative and fractional tracking', () => {
    const runs: StyledRun[] = [{ text: 'a', letterSpacing: -1.25 }, { text: 'b', letterSpacing: 0.5 }];
    runsToDom(runs, parent);
    expect(domToRuns(parent)).toEqual(runs);
  });

  it('normalizes explicit false flags to absent keys', () => {
    // Run-level flags are additive over the node style — a run cannot un-set
    // one — so `false` is not a storable value, it is the absence of the key.
    runsToDom([{ text: 'a', underline: false, strikethrough: false, bold: false }], parent);
    expect(domToRuns(parent)).toEqual([{ text: 'a' }]);
  });

  it('round-trips markup-significant characters verbatim', () => {
    const runs: StyledRun[] = [
      { text: '<b>&amp;</b>', underline: true },
      { text: ' "quoted" & <s> ', letterSpacing: 1 },
    ];
    runsToDom(runs, parent);
    expect(domToRuns(parent)).toEqual(runs);
  });

  it('round-trips the new keys alongside the old ones', () => {
    const runs: StyledRun[] = [
      { text: 'a', bold: true, underline: true },
      {
        text: 'b',
        italic: true,
        strikethrough: true,
        letterSpacing: 3,
        fontSize: 24,
        fontFamily: 'mono',
        fill: { fill: 'solid', color: 'rgb(255, 0, 0)' },
      },
      { text: 'c' },
    ];
    runsToDom(runs, parent);
    expect(domToRuns(parent)).toEqual(runs);
  });

  it('is idempotent across a range of shapes', () => {
    const shapes: StyledRun[][] = [
      [{ text: 'plain' }],
      [{ text: 'a', underline: true }, { text: 'b' }],
      [{ text: 'a', strikethrough: true, letterSpacing: 0 }],
      [{ text: 'a\nb', underline: true, letterSpacing: -2 }],
      [
        { text: 'mixed ', bold: true, underline: true },
        { text: 'tail', italic: true, strikethrough: true, letterSpacing: 1.5 },
      ],
    ];
    for (const shape of shapes) {
      runsToDom(shape, parent);
      const once = domToRuns(parent);
      expect(once).toEqual(shape);
      runsToDom(once, parent);
      const twice = domToRuns(parent);
      expect(twice).toEqual(once);
    }
  });
});

describe('charOffsetToDomPosition', () => {
  let parent: HTMLDivElement;
  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  it('returns the first text node and the requested offset for offset within first run', () => {
    runsToDom([{ text: 'hello' }, { text: ' world', bold: true }], parent);
    const pos = charOffsetToDomPosition(parent, 3);
    expect(pos).not.toBeNull();
    expect(pos!.node.nodeType).toBe(Node.TEXT_NODE);
    expect((pos!.node as Text).data).toBe('hello');
    expect(pos!.offset).toBe(3);
  });

  it('advances into the next text node when offset spans run boundaries', () => {
    runsToDom([{ text: 'hello' }, { text: ' world', bold: true }], parent);
    const pos = charOffsetToDomPosition(parent, 7);
    expect(pos!.node.nodeType).toBe(Node.TEXT_NODE);
    expect((pos!.node as Text).data).toBe(' world');
    expect(pos!.offset).toBe(2);
  });

  it('clamps to the end when offset exceeds total length', () => {
    runsToDom([{ text: 'hi' }], parent);
    const pos = charOffsetToDomPosition(parent, 999);
    expect(pos!.node.nodeType).toBe(Node.TEXT_NODE);
    expect(pos!.offset).toBe(2);
  });

  it('returns offset 0 in the parent itself when overlay is empty', () => {
    const pos = charOffsetToDomPosition(parent, 0);
    expect(pos!.node).toBe(parent);
    expect(pos!.offset).toBe(0);
  });
});

describe('domPositionToCharOffset', () => {
  let parent: HTMLDivElement;
  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  it('returns 0 for the start of the first text node', () => {
    runsToDom([{ text: 'abc' }, { text: 'def', bold: true }], parent);
    const textNode = parent.querySelectorAll('span[data-run]')[0].firstChild as Text;
    expect(domPositionToCharOffset(parent, textNode, 0)).toBe(0);
  });

  it('counts characters from preceding text nodes when position is in a later node', () => {
    runsToDom([{ text: 'abc' }, { text: 'def', bold: true }], parent);
    const second = parent.querySelectorAll('span[data-run]')[1].firstChild as Text;
    expect(domPositionToCharOffset(parent, second, 2)).toBe(5);
  });

  it('round-trips char → dom → char', () => {
    runsToDom([{ text: 'hello ' }, { text: 'bold', bold: true }, { text: ' tail' }], parent);
    for (const off of [0, 3, 6, 8, 10, 15]) {
      const pos = charOffsetToDomPosition(parent, off);
      expect(pos).not.toBeNull();
      expect(domPositionToCharOffset(parent, pos!.node, pos!.offset)).toBe(Math.min(off, 15));
    }
  });

  // An element container's offset indexes child nodes, not characters — the
  // shape `Range.selectNodeContents` produces, and so the shape of the
  // select-all caret `useTextEdit` starts an edit with.
  it('reads an element position as the text preceding that child index', () => {
    runsToDom([{ text: 'abc' }, { text: 'def', bold: true }], parent);
    expect(domPositionToCharOffset(parent, parent, 0)).toBe(0);
    expect(domPositionToCharOffset(parent, parent, 1)).toBe(3);
    expect(domPositionToCharOffset(parent, parent, 2)).toBe(6);
  });

  it('clamps an element offset past the last child to the end of the text', () => {
    runsToDom([{ text: 'abc' }], parent);
    expect(domPositionToCharOffset(parent, parent, 99)).toBe(3);
  });

  it('resolves a position inside a run span, not just on the overlay', () => {
    runsToDom([{ text: 'abc' }, { text: 'def', bold: true }], parent);
    const second = parent.querySelectorAll('span[data-run]')[1];
    expect(domPositionToCharOffset(parent, second, 0)).toBe(3);
    expect(domPositionToCharOffset(parent, second, 1)).toBe(6);
  });
});
