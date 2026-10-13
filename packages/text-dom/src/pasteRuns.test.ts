import { describe, expect, it } from 'vitest';
import { clipboardRuns, htmlToRuns } from './pasteRuns';

/** The styles Chromium writes onto every element it copies, as it wrote them for a page's `<p>`. */
const COMPUTED =
  'font-style: normal; font-variant-ligatures: normal; font-variant-caps: normal; font-weight: 400; '
  + 'letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; widows: 2; '
  + 'word-spacing: 0px; -webkit-text-stroke-width: 0px; white-space: normal; text-decoration-thickness: initial; '
  + 'text-decoration-style: initial; text-decoration-color: initial;';

function transfer(data: Record<string, string>): DataTransfer {
  return { getData: (type: string) => data[type] ?? '' } as DataTransfer;
}

describe('htmlToRuns', () => {
  it('reads what Chromium copies from a page: blocks as lines, cells after tabs, emphasis and nothing else', () => {
    const html =
      `<p style="${COMPUTED} color: red; font-family: Georgia; font-size: 30px;">Hello <b>bold</b> and <i>it</i></p>`
      + `<ul style="color: rgb(0, 0, 0); font-family: Times; font-size: medium; ${COMPUTED}"><li>one</li><li>two</li></ul>`
      + `<table style="${COMPUTED}"><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></tbody></table>`;
    expect(htmlToRuns(html)).toEqual([
      { text: 'Hello ' },
      { text: 'bold', bold: true },
      { text: ' and ' },
      { text: 'it', italic: true },
      { text: '\none\ntwo\na\tb\nc\td' },
    ]);
  });

  it('reads what Chromium copies from the overlay: a weight as bold, kept white space, no color', () => {
    const span = (style: string, text: string) =>
      `<span data-run="" style="color: rgb(0, 0, 0); font-family: Arial; font-size: 20px; ${style} white-space: pre;">${text}</span>`;
    const html = span('font-weight: 400;', 'plain ') + span('font-weight: 700;', 'bold\nline')
      + span('font-weight: 400; color: rgb(255, 0, 0);', '  red');
    expect(htmlToRuns(html)).toEqual([
      { text: 'plain ' },
      { text: 'bold\nline', bold: true },
      { text: '  red' },
    ]);
  });

  it('collapses white space as a browser draws it', () => {
    expect(htmlToRuns('<p>\n  one\n  two  </p>\n<p> three</p>')).toEqual([{ text: 'one two\nthree' }]);
    expect(htmlToRuns('<span>a </span><span> b</span>')).toEqual([{ text: 'a b' }]);
    expect(htmlToRuns('<pre>a\n  b</pre>')).toEqual([{ text: 'a\n  b' }]);
    expect(htmlToRuns('<div style="white-space-collapse: preserve">a  b</div>')).toEqual([{ text: 'a  b' }]);
  });

  it('reads a break as a line of its own and a block as one line, however deep', () => {
    expect(htmlToRuns('a<br>b')).toEqual([{ text: 'a\nb' }]);
    expect(htmlToRuns('<p>a</p><p><br></p><p>b</p>')).toEqual([{ text: 'a\n\nb' }]);
    expect(htmlToRuns('<div>a<br></div><div>b</div>')).toEqual([{ text: 'a\nb' }]);
    expect(htmlToRuns('<div><div><blockquote>a</blockquote></div></div>b<h2>c</h2>')).toEqual([{ text: 'a\nb\nc' }]);
    expect(htmlToRuns('a<br class="Apple-interchange-newline">')).toEqual([{ text: 'a' }]);
    expect(htmlToRuns('<table><tr><td>a </td><td></td></tr><tr><td>c</td></tr></table>')).toEqual([{ text: 'a\nc' }]);
  });

  it('keeps the rules and the scripts, and reads a heavy weight as bold', () => {
    expect(htmlToRuns(
      '<u>u</u><s>s</s><span style="text-decoration: overline">o</span><sup>2</sup><sub>3</sub><span style="font-weight: 600">w</span>',
    )).toEqual([
      { text: 'u', underline: true },
      { text: 's', strikethrough: true },
      { text: 'o', overline: true },
      { text: '2', script: 'super' },
      { text: '3', script: 'sub' },
      { text: 'w', bold: true },
    ]);
  });

  it('reads no text out of what a page does not show', () => {
    expect(htmlToRuns(
      '<meta charset="utf-8"><style>p { color: red }</style><!--StartFragment--><script>x()</script><p>a</p><!--EndFragment-->',
    )).toEqual([{ text: 'a' }]);
  });
});

describe('clipboardRuns', () => {
  it('prefers markup, and falls back to plain text when the markup holds none', () => {
    expect(clipboardRuns(transfer({ 'text/html': '<b>a</b>', 'text/plain': 'a' }))).toEqual([{ text: 'a', bold: true }]);
    expect(clipboardRuns(transfer({ 'text/html': '<img src="x.png">', 'text/plain': 'x.png' }))).toEqual([{ text: 'x.png' }]);
  });

  it('reads plain text as one run, a CRLF as its line feed', () => {
    expect(clipboardRuns(transfer({ 'text/plain': 'a\r\nb\tc' }))).toEqual([{ text: 'a\nb\tc' }]);
    expect(clipboardRuns(transfer({}))).toEqual([]);
  });
});
