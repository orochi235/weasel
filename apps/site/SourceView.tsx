import { CodeBlock } from '@weasel-js/ui';
import type { DemoSourceTab } from './registry';

/** Syntax-highlighted source for one code-panel tab.
 *
 *  Its own module so `prism-react-renderer` loads with the panel rather than
 *  with the entry bundle — the panel already fetches its text on demand, and
 *  a visitor who never scrolls to it never needs the highlighter either. */
export default function SourceView(
  { code, language }: { code: string; language: DemoSourceTab['language'] },
) {
  return <CodeBlock code={code} language={language} lineNumbers />;
}
