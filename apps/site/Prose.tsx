import { CodeBlock, type CodeLanguage } from '@weasel-js/ui/components/CodeBlock';
import type { MarkdownBlock } from '../shared/markdown';
import s from './Prose.module.css';

/** The fence languages `CodeBlock` can color; anything else, a shell line included, stays plain. */
const HIGHLIGHTED = new Set<string>(['tsx', 'ts', 'jsx', 'js', 'json', 'css']);

/**
 * Markdown the build already rendered: a README, a guide, a doc comment. The
 * HTML is the repo's own writing, run through `marked` where the site is built.
 */
export function Prose({ blocks, className }: { blocks: readonly MarkdownBlock[]; className?: string }) {
  return (
    <div className={className ? `${s.prose} ${className}` : s.prose}>
      {blocks.map((block, i) => {
        if (block.kind === 'html') return <div key={i} dangerouslySetInnerHTML={{ __html: block.html }} />;
        return (
          <div key={i} className={s.code}>
            {HIGHLIGHTED.has(block.language) ? (
              <CodeBlock code={block.code} language={block.language as CodeLanguage} />
            ) : (
              <pre><code>{block.code}</code></pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
