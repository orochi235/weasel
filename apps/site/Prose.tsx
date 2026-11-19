import { CodeBlock, type CodeLanguage } from '@weasel-js/ui/components/CodeBlock';
import type { MarkdownBlock } from '@shared/markdown';
import { hasOwnKey } from '@weasel-js/registry';
import s from './Prose.module.css';

/** Every language `CodeBlock` colors, so a language it gains fails to compile until it is listed here. */
const COLORED: Record<Exclude<CodeLanguage, 'text'>, true> = {
  tsx: true, ts: true, typescript: true, jsx: true, js: true, javascript: true, json: true, css: true,
  markup: true, markdown: true, md: true,
};
const FENCE_ALIASES: Readonly<Record<string, CodeLanguage>> = { html: 'markup', xml: 'markup', svg: 'markup' };

/** The language `CodeBlock` colors a fence in, or `null` to leave it plain, a shell line included. */
function fenceLanguage(fence: string): CodeLanguage | null {
  if (hasOwnKey(COLORED, fence)) return fence;
  return hasOwnKey(FENCE_ALIASES, fence) ? FENCE_ALIASES[fence]! : null;
}

/**
 * Markdown the build already rendered: a README, a guide, a doc comment. The
 * HTML is the repo's own writing, run through `marked` where the site is built.
 */
export function Prose({ blocks, className }: { blocks: readonly MarkdownBlock[]; className?: string }) {
  return (
    <div className={className ? `${s.prose} ${className}` : s.prose}>
      {blocks.map((block, i) => {
        if (block.kind === 'html') return <div key={i} dangerouslySetInnerHTML={{ __html: block.html }} />;
        const language = fenceLanguage(block.language);
        return (
          <div key={i} className={s.code}>
            {language ? (
              <CodeBlock code={block.code} language={language} />
            ) : (
              <pre><code>{block.code}</code></pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
