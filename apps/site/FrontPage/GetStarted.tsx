import { CodeBlock, type CodeLanguage } from '@weasel-js/ui';
import blocks from 'virtual:get-started';
import s from './GetStarted.module.css';

/** The fence languages the README uses that `CodeBlock` can color; a shell line stays plain. */
const HIGHLIGHTED = new Set<string>(['tsx', 'ts', 'jsx', 'js', 'json', 'css']);

/** Install and overview, from core's README. */
export function GetStarted() {
  return (
    <article className={s.page}>
      <header>
        <div className="ckd-eyebrow">Guide</div>
        <h2 className={s.heading}>Get started</h2>
      </header>
      <div className={s.prose}>
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
    </article>
  );
}
