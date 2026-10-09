import { Highlight, Prism, type PrismTheme } from 'prism-react-renderer';
import type { CSSProperties } from 'react';
import s from './CodeBlock.module.css';

/** A language the bundled highlighter reads. */
export type CodeLanguage =
  | 'tsx' | 'ts' | 'typescript' | 'jsx' | 'js' | 'javascript' | 'json' | 'css' | 'markup' | 'markdown' | 'md';

/** Props for {@link CodeBlock}. */
export interface CodeBlockProps {
  code: string;
  /** Default `'tsx'`. */
  language?: CodeLanguage;
  /** Number each line in a gutter the reader cannot select. Default `false`. */
  lineNumbers?: boolean;
  /** Class on the `<pre>`, which is the element that scrolls. */
  className?: string;
  /** Test id on the `<pre>`. */
  'data-testid'?: string;
}

const UNSTYLED: PrismTheme = { plain: {}, styles: [] };

// The Prism that prism-react-renderer bundles predates its `literal-property` rule, so an object literal's keys read
// as plain text and `default:` as a keyword. This is that rule; each grammar copied javascript's when it loaded.
for (const lang of ['javascript', 'typescript', 'jsx', 'tsx']) {
  const grammar = Prism.languages[lang];
  if (!grammar || 'literal-property' in grammar) continue;
  Prism.languages.insertBefore(lang, 'keyword', {
    'literal-property': {
      pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
      lookbehind: true,
      alias: 'property',
    },
  });
}

/**
 * A block of source, syntax-highlighted, in the monospace face. Token colors come from the theme's `--wzl-code-*`
 * tokens, so a block reads in either mode and a theme can recolor it.
 */
export function CodeBlock({ code, language = 'tsx', lineNumbers = false, className, ...rest }: CodeBlockProps) {
  return (
    <Highlight code={code} language={language} theme={UNSTYLED}>
      {({ tokens, getLineProps, getTokenProps }) => {
        // The gutter holds the widest number; a custom property is the one thing set inline.
        const gutter = { '--code-gutter': `${String(tokens.length).length}ch` } as CSSProperties;
        return (
          <pre className={[s.block, lineNumbers && s.numbered, className].filter(Boolean).join(' ')}
            style={lineNumbers ? gutter : undefined} data-testid={rest['data-testid']}>
            <code>
              {tokens.map((line, i) => {
                const { key: _line, className: lineClass, style: _lineStyle, ...lineProps } = getLineProps({ line });
                return (
                  <span key={i} {...lineProps} className={`${lineClass} ${s.line}`}>
                    {lineNumbers && <span className={s.lineNo} aria-hidden>{i + 1}</span>}
                    <span className={s.lineText}>
                      {line.map((token, j) => {
                        const { key: _token, style: _tokenStyle, ...tokenProps } = getTokenProps({ token });
                        return <span key={j} {...tokenProps} />;
                      })}
                    </span>
                  </span>
                );
              })}
            </code>
          </pre>
        );
      }}
    </Highlight>
  );
}
