/**
 * Inline markdown for demo prose. Blurbs in `registry.ts` are written with
 * backticked symbol names, emphasis and the occasional link; this renders
 * that rather than printing the punctuation.
 *
 * Built from marked's inline tokens instead of its HTML, so nothing reaches
 * `dangerouslySetInnerHTML`. Inline only — a blurb is one paragraph, and
 * headings or lists in one would be a sign it belongs in the demo's own page.
 */
import { Fragment, type ReactElement, type ReactNode } from 'react';
import { Lexer, type Token } from 'marked';

export function InlineMarkdown({ text }: { text: string }): ReactElement {
  return <>{renderTokens(Lexer.lexInline(text))}</>;
}

function renderTokens(tokens: readonly Token[]): ReactNode[] {
  return tokens.map((token, i) => <Fragment key={i}>{renderToken(token)}</Fragment>);
}

function childrenOf(token: Token): ReactNode[] {
  const kids = (token as { tokens?: Token[] }).tokens;
  return kids ? renderTokens(kids) : [(token as { text?: string }).text ?? ''];
}

function renderToken(token: Token): ReactNode {
  switch (token.type) {
    case 'codespan':
      return <code>{token.text}</code>;
    case 'strong':
      return <strong>{childrenOf(token)}</strong>;
    case 'em':
      return <em>{childrenOf(token)}</em>;
    case 'del':
      return <del>{childrenOf(token)}</del>;
    case 'link':
      return <a href={token.href} target="_blank" rel="noreferrer">{childrenOf(token)}</a>;
    case 'br':
      return <br />;
    default:
      // `text` and `escape` carry their content verbatim; anything block-shaped
      // that slipped through renders as the source it came from.
      return (token as { text?: string }).text ?? (token as { raw?: string }).raw ?? '';
  }
}
