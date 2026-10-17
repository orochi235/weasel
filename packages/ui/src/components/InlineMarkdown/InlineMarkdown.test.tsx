import { describe, it, expect } from 'vitest';
import { InlineMarkdown } from './InlineMarkdown';
import { inlineMarkdownText } from './parseInline';
import { renderWithIcons } from '../../testing/withIcons';

const html = (text: string, links?: 'anchor' | 'text') =>
  renderWithIcons(<InlineMarkdown text={text} links={links} />).container;

describe('InlineMarkdown', () => {
  it('renders a backticked fragment as code, not backticks', () => {
    const c = html('A registered consumer op (`setColor`) records onto the stack.');
    expect(c.querySelector('code')?.textContent).toBe('setColor');
    expect(c.textContent).not.toContain('`');
  });

  it('renders emphasis, strong, and strikethrough', () => {
    const c = html('Every gesture *form* is **one** ~~two~~ surface.');
    expect(c.querySelector('em')?.textContent).toBe('form');
    expect(c.querySelector('strong')?.textContent).toBe('one');
    expect(c.querySelector('del')?.textContent).toBe('two');
    expect(c.textContent).toBe('Every gesture form is one two surface.');
  });

  it('renders a kbd shortcut as one key cap per key, in the reader’s own legend', () => {
    const c = html('Press <kbd>Mod+Shift+Z</kbd> to redo, or <kbd>Escape</kbd>.');
    const caps = [...c.querySelectorAll('kbd')].map((k) => k.textContent);
    expect(caps.slice(-2, -1)).toEqual(['Z']);
    expect(caps).toHaveLength(4);
    expect(c.textContent).not.toContain('Mod');
    expect(inlineMarkdownText('Press <kbd>Mod+Z</kbd>.')).toBe('Press Mod+Z.');
  });

  it('renders marks inside marks', () => {
    const c = html('**never `eval`** it');
    expect(c.querySelector('strong code')?.textContent).toBe('eval');
  });

  it('renders a link that opens away from the page', () => {
    const a = html('See [the spec](https://example.com/spec).').querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://example.com/spec');
    expect(a?.getAttribute('rel')).toBe('noreferrer');
  });

  it('draws a link as its label where links are text', () => {
    const c = html('See [the spec](https://example.com/spec).', 'text');
    expect(c.querySelector('a')).toBeNull();
    expect(c.textContent).toBe('See the spec.');
  });

  it('draws a link with a script href as its label', () => {
    const c = html('[run](javascript:alert(1))');
    expect(c.querySelector('a')).toBeNull();
    expect(c.textContent).toContain('run');
  });

  it('leaves prose punctuation alone', () => {
    for (const text of ['Cmd/Ctrl+Z — undo & redo, where a < b.', 'a * b * c', 'matches *.ts and snake_case_name']) {
      expect(html(text).textContent).toBe(text);
    }
  });

  it('keeps marks inside code and after a backslash', () => {
    expect(html('`a * b && **c**` holds.').querySelector('code')?.textContent).toBe('a * b && **c**');
    const c = html('a literal \\`tick\\` and \\*star\\*');
    expect(c.querySelector('code, em')).toBeNull();
    expect(c.textContent).toBe('a literal `tick` and *star*');
  });
});

describe('inlineMarkdownText', () => {
  it('takes the marks off and keeps the words', () => {
    expect(inlineMarkdownText('Sets `fill` to **one** of [these](/x).')).toBe('Sets fill to one of these.');
  });
});
