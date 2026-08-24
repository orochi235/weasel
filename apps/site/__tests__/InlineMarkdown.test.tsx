import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { InlineMarkdown } from '../InlineMarkdown';

const html = (text: string) => render(<InlineMarkdown text={text} />).container;

describe('InlineMarkdown', () => {
  it('renders a backticked fragment as code, not backticks', () => {
    const c = html('A registered consumer op (`setColor`) records onto the stack.');
    expect(c.querySelector('code')?.textContent).toBe('setColor');
    expect(c.textContent).not.toContain('`');
  });

  it('renders emphasis and strong', () => {
    const c = html('Every gesture *form* is **one** surface.');
    expect(c.querySelector('em')?.textContent).toBe('form');
    expect(c.querySelector('strong')?.textContent).toBe('one');
    expect(c.textContent).toBe('Every gesture form is one surface.');
  });

  it('renders a link that opens away from the demo', () => {
    const c = html('See [the spec](https://example.com/spec).');
    const a = c.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://example.com/spec');
    expect(a?.getAttribute('rel')).toBe('noreferrer');
  });

  it('leaves prose punctuation alone', () => {
    // Ampersands, angle brackets and em dashes are common in blurbs and must
    // survive as themselves rather than as entities.
    const text = 'Cmd/Ctrl+Z — undo & redo, where a < b.';
    expect(html(text).textContent).toBe(text);
  });

  it('renders code containing markup characters verbatim', () => {
    const c = html('`a < b && c` holds.');
    expect(c.querySelector('code')?.textContent).toBe('a < b && c');
  });
});
