import type { Code } from '../../../shared/reference';
import s from './Reference.module.css';

/** Code the build wrote out, each name that has a page linked to it. */
export function CodeText({ code }: { code: Code }) {
  return (
    <>
      {code.map((token, i) =>
        typeof token === 'string' ? token : <a key={i} href={`#${token.to}`}>{token.text}</a>,
      )}
    </>
  );
}

/** A declaration on a line of its own. */
export function CodeLine({ code }: { code: Code }) {
  return <pre className={s.declaration}><code><CodeText code={code} /></code></pre>;
}
