import { describe, it, expect, beforeEach } from 'vitest';
import { runsToDom } from './domRuns';
import { domToRuns } from './domRuns';
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
});
