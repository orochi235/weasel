import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('places the box for an element inside a frame by the frame\'s offset, and follows the frame\'s scroll', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const inner = frame.contentDocument!;
    inner.body.innerHTML = '<button id="btn"></button>';
    const button = inner.getElementById('btn')!;
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 300, 200));
    let buttonTop = 10;
    vi.spyOn(button, 'getBoundingClientRect').mockImplementation(() => new DOMRect(5, buttonTop, 20, 8));
    const highlighter = createA11yHighlighter(document);
    highlighter.show([['iframe', '#btn']]);
    const box = boxes()[0] as HTMLElement;
    expect([box.style.left, box.style.top, box.style.width, box.style.height]).toEqual(['105px', '60px', '20px', '8px']);
    buttonTop = -30;
    frame.contentWindow!.dispatchEvent(new Event('scroll'));
    expect(box.style.top).toBe('20px');
    highlighter.dispose();
    vi.restoreAllMocks();
  });
});
