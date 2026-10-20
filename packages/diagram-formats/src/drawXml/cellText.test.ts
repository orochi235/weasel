import { describe, expect, it } from 'vitest';
import { cellLines } from './cellText';

describe('cellLines', () => {
  it('splits plain text at its line breaks', () => {
    expect(cellLines('One\nTwo', false)).toEqual(['One', 'Two']);
    expect(cellLines('', false)).toEqual([]);
  });

  it('keeps a tag in plain text as text', () => {
    expect(cellLines('a <b> c', false)).toEqual(['a <b> c']);
  });

  it('strips tags from HTML and keeps a break as a new line', () => {
    expect(cellLines('<b>Bold</b> word<br>next<br/>last', true)).toEqual(['Bold word', 'next', 'last']);
  });

  it('starts a new line at each block', () => {
    expect(cellLines('<div>First</div><div>Second</div>', true)).toEqual(['First', 'Second']);
    expect(cellLines('Lead<div>Then</div>', true)).toEqual(['Lead', 'Then']);
  });

  it('decodes entities', () => {
    expect(cellLines('a&nbsp;&amp;&nbsp;b &lt;c&gt; &#65;&#x42;', true)).toEqual(['a & b <c> AB']);
  });

  it('keeps an empty line between two, and none at either end', () => {
    expect(cellLines('<div>a</div><div><br></div><div>b</div>', true)).toEqual(['a', '', 'b']);
  });
});
