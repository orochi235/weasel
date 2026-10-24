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

  it('defaults to the subtle variant, with no grade, emphasis, or tint', () => {
    const { container } = render(<Code>x</Code>);
    const el = container.firstElementChild!;
    expect(el.hasAttribute('data-grade')).toBe(false);
    expect(el.hasAttribute('data-emphasis')).toBe(false);
    expect(el.hasAttribute('data-tint')).toBe(false);
    expect(el.hasAttribute('data-stance')).toBe(false);
    expect(el.getAttribute('data-variant')).toBe('subtle');
    expect(el.getAttribute('data-size')).toBeNull();
  });

  it('reports grade, variant and size as data attributes', () => {
    const { container } = render(<Code grade="danger" variant="plain" size="sm">x</Code>);
    const el = container.firstElementChild!;
    expect(el.getAttribute('data-grade')).toBe('danger');
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

  it('takes a tint and a stance beside its grade', () => {
    const { container } = render(<Code grade="danger" stance="debug" tint={1}>x</Code>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.dataset.grade).toBe('danger');
    expect(el.dataset.stance).toBe('debug');
    expect(el.dataset.tint).toBe('1');
    expect(el.style.getPropertyValue('--wzl-tint')).not.toBe('');
  });

  it('paints a tint or a stance accent over the grade and emphasis', () => {
    expect(rule('.code')).toMatch(/--code-fg:\s*var\(--_s-accent, var\(--code-emphasis-fg\)\)/);
    expect(css).not.toMatch(/\[data-tone='/);
  });

  it('colors the text from emphasis and grade', () => {
    expect(css).toMatch(/\.code\s*\{[^}]*--code-emphasis-fg:\s*var\(--wzl-emphasis-fg, var\(--wzl-fg\)\)/);
    expect(css).toMatch(/\.code\[data-grade\]\s*\{\s*--_s-accent:\s*var\(--wzl-tint, var\(--wzl-grade\)\)/);
    expect(css).not.toMatch(/--code-emphasis-fg:\s*var\(--wzl-grade\)/);
  });

  it('drops the chip fill in the plain variant', () => {
    expect(css).toMatch(/\[data-variant='plain'\]\s*\{[^}]*background:\s*transparent/);
  });
});
