import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CodeBlock } from './CodeBlock';

afterEach(cleanup);

const SOURCE = "const width = 4;\nconst on = true;\nlabel('grid');";

describe('<CodeBlock>', () => {
  it('keeps the source text exactly, so a selection copies what was printed', () => {
    const { container } = render(<CodeBlock code={SOURCE} />);
    const lines = [...container.querySelectorAll('pre code > span')].map((l) => l.textContent);
    expect(lines.join('\n')).toBe(SOURCE);
  });

  it('draws `text` as its lines alone, with no token colored', () => {
    const { container } = render(<CodeBlock code={SOURCE} language="text" />);
    expect(container.querySelectorAll('.token')).toHaveLength(0);
    expect([...container.querySelectorAll('pre code > span')].map((l) => l.textContent).join('\n')).toBe(SOURCE);
  });

  it('marks each token with the class its color is keyed on', () => {
    const { container } = render(<CodeBlock code={SOURCE} />);
    const tokenOf = (text: string) => [...container.querySelectorAll('.token')].find((t) => t.textContent === text);
    expect(tokenOf('const')?.classList).toContain('keyword');
    expect(tokenOf('4')?.classList).toContain('number');
    expect(tokenOf('true')?.classList).toContain('boolean');
    expect(tokenOf("'grid'")?.classList).toContain('string');
    expect(tokenOf('label')?.classList).toContain('function');
  });

  it("reads an object literal's keys as properties, a key named like a keyword included", () => {
    const { container } = render(<CodeBlock code={"const leaf = { kind: 'number', default: 8 };"} />);
    const tokenOf = (text: string) => [...container.querySelectorAll('.token')].find((t) => t.textContent === text);
    expect(tokenOf('kind')?.classList).toContain('property');
    expect(tokenOf('default')?.classList).toContain('property');
    expect(tokenOf('default')?.classList).not.toContain('keyword');
  });

  it('draws an element only for a token that is colored, so a long block stays a small tree', () => {
    const { container } = render(<CodeBlock code={SOURCE} />);
    expect(container.querySelector('.plain')).toBeNull();
    const line = container.querySelector('pre code > span')!;
    expect([...line.children].every((el) => el.classList.contains('token'))).toBe(true);
  });

  it('paints no color of its own inline, leaving every color to the theme', () => {
    const { container } = render(<CodeBlock code={SOURCE} />);
    expect(container.querySelector('[style*="color"]')).toBeNull();
  });

  it('numbers lines in a gutter the reader does not select or hear', () => {
    const { container } = render(<CodeBlock code={SOURCE} lineNumbers />);
    const numbers = [...container.querySelectorAll('[aria-hidden]')].map((n) => n.textContent);
    expect(numbers).toEqual(['1', '2', '3']);
  });
});
