import { afterEach, describe, expect, it } from 'vitest';
import { createA11yHighlighter, resolveTarget } from './a11yHighlight';

const boxes = () => document.querySelectorAll('[data-fg-a11y-highlight]');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('resolveTarget', () => {
  it('finds the element a selector names, and nothing for one that names none or does not parse', () => {
    document.body.innerHTML = '<img id="cat">';
    expect(resolveTarget(document, ['#cat'])).toBe(document.getElementById('cat'));
    expect(resolveTarget(document, ['#dog'])).toBeNull();
    expect(resolveTarget(document, ['[[['])).toBeNull();
  });

  it('steps into a shadow root for each selector after the first', () => {
    document.body.innerHTML = '<div id="outer"></div>';
    const shadow = document.getElementById('outer')!.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<img id="inner">';
    expect(resolveTarget(document, ['#outer', '#inner'])).toBe(shadow.getElementById('inner'));
  });
});

describe('createA11yHighlighter', () => {
  it('draws one box per element found, replaces them on the next show, and clears on an empty one', () => {
    document.body.innerHTML = '<img id="a"><img id="b">';
    const highlighter = createA11yHighlighter(document);
    highlighter.show([['#a'], ['#b'], ['#missing']]);
    expect(boxes()).toHaveLength(2);
    highlighter.show([['#a']]);
    expect(boxes()).toHaveLength(1);
    highlighter.show([]);
    expect(boxes()).toHaveLength(0);
    highlighter.show([['#a']]);
    highlighter.dispose();
    expect(boxes()).toHaveLength(0);
    expect(document.querySelector('[data-fg-a11y-highlight-style]')).toBeNull();
  });
});
