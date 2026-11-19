import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Prose } from '../Prose';

afterEach(cleanup);

/** Whether a fence in `language` reached `CodeBlock`, which colors it into token spans, rather than a plain `<pre>`. */
function colored(language: string, code: string): boolean {
  const { container } = render(<Prose blocks={[{ kind: 'code', language, code }]} />);
  const spans = container.querySelectorAll('pre code span').length;
  cleanup();
  return spans > 0;
}

describe('a fenced block in prose', () => {
  it('is colored in every language CodeBlock reads, under its long names too', () => {
    for (const language of ['ts', 'tsx', 'typescript', 'js', 'javascript', 'jsx']) {
      expect(colored(language, 'const a = 1;'), language).toBe(true);
    }
    expect(colored('json', '{ "a": 1 }')).toBe(true);
    expect(colored('css', 'a { color: red; }')).toBe(true);
    expect(colored('markdown', '# Title')).toBe(true);
  });

  it('reads html, xml and svg fences as markup', () => {
    for (const language of ['html', 'xml', 'svg']) expect(colored(language, '<a href="x">y</a>'), language).toBe(true);
  });

  it('stays plain for a language CodeBlock does not read', () => {
    expect(colored('sh', 'npm install')).toBe(false);
    expect(colored('toString', 'x')).toBe(false);
  });
});
