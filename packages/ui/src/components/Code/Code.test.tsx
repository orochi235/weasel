import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Code } from './Code';

const css = readFileSync(resolve(__dirname, 'Code.module.css'), 'utf8');
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`(^|\\n)${esc}\\s*\\{([^}]*)\\}`))?.[2] ?? '';
};

describe('Code', () => {
  it('renders its text verbatim in a <code> element', () => {
    const { container } = render(<Code>editor.insert</Code>);
    const el = container.firstElementChild!;
    expect(el.tagName).toBe('CODE');
    expect(el.textContent).toBe('editor.insert');
  });

  it('defaults to the neutral tone and the subtle variant', () => {
    const { container } = render(<Code>x</Code>);
    const el = container.firstElementChild!;
    expect(el.getAttribute('data-tone')).toBe('neutral');
    expect(el.getAttribute('data-variant')).toBe('subtle');
    expect(el.getAttribute('data-size')).toBeNull();
  });

  it('reports tone, variant and size as data attributes', () => {
    const { container } = render(<Code tone="danger" variant="plain" size="sm">x</Code>);
    const el = container.firstElementChild!;
    expect(el.getAttribute('data-tone')).toBe('danger');
    expect(el.getAttribute('data-variant')).toBe('plain');
    expect(el.getAttribute('data-size')).toBe('sm');
  });

  it('merges a consumer className', () => {
    const { container } = render(<Code className="mine">x</Code>);
    expect(container.firstElementChild!.className).toMatch(/\bmine\b/);
  });

  it('sets monospace type, keeps case, and wraps long strings inside the chip', () => {
    const body = rule('.code');
    expect(body).toMatch(/font-family:\s*var\(--wzl-font-mono\)/);
    expect(body).not.toMatch(/text-transform/);
    expect(body).toMatch(/overflow-wrap:\s*anywhere/);
    expect(body).toMatch(/box-decoration-break:\s*clone/);
  });

  it('paints each tone from a theme token, accent as text', () => {
    expect(css).toMatch(/\[data-tone='accent'\]\s*\{\s*--code-fg:\s*var\(--wzl-accent-fg\)/);
    expect(css).toMatch(/\[data-tone='success'\]\s*\{\s*--code-fg:\s*var\(--wzl-success\)/);
    expect(css).toMatch(/\[data-tone='warn'\]\s*\{\s*--code-fg:\s*var\(--wzl-warning\)/);
    expect(css).toMatch(/\[data-tone='danger'\]\s*\{\s*--code-fg:\s*var\(--wzl-danger\)/);
  });

  it('drops the chip fill in the plain variant', () => {
    expect(css).toMatch(/\[data-variant='plain'\]\s*\{[^}]*background:\s*transparent/);
  });
});
