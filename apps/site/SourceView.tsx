import { Highlight, themes } from 'prism-react-renderer';
import type { DemoSourceTab } from './registry';

/** Syntax-highlighted source for one code-panel tab.
 *
 *  Its own module so `prism-react-renderer` loads with the panel rather than
 *  with the entry bundle — the panel already fetches its text on demand, and
 *  a visitor who never scrolls to it never needs the highlighter either. */
export default function SourceView(
  { code, language }: { code: string; language: DemoSourceTab['language'] },
) {
  return (
    <Highlight code={code} language={language} theme={themes.vsDark}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre className={className} style={{ ...style, background: 'transparent', margin: 0 }}>
          {(() => {
            const lineNoWidth = String(tokens.length).length;
            return tokens.map((line, i) => {
              const { key: _lk, ...lineProps } = getLineProps({ line });
              return (
                <div key={i} {...lineProps} className={`${lineProps.className ?? ''} ckd-line`.trim()}>
                  <span className="ckd-line-no" style={{ minWidth: `${lineNoWidth}ch` }} aria-hidden>
                    {i + 1}
                  </span>
                  <span className="ckd-line-content">
                    {line.map((token, j) => {
                      const { key: _tk, ...tokenProps } = getTokenProps({ token });
                      return <span key={j} {...tokenProps} />;
                    })}
                  </span>
                </div>
              );
            });
          })()}
        </pre>
      )}
    </Highlight>
  );
}
