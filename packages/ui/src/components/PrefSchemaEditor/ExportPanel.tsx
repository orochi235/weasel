import { useMemo, useState } from 'react';
import { Button } from '../Button';
import { CodeBlock } from '../CodeBlock';
import { PaneHeader } from './PaneHeader';
import type { SchemaRoot } from './schemaEdit';
import type { PrefTypes } from './types';
import { formatChanges, printSchema, type SchemaChange } from './schemaExport';
import s from './PrefSchemaEditor.module.css';

function Copy({ text }: { text: string }) {
  return <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard?.writeText(text).catch(() => {}); }}>Copy</Button>;
}

/** Where the changes go when the reader submits them; a promise it returns says whether they arrived. */
export type SubmitChanges = (changes: readonly SchemaChange[], literal: string) => void | Promise<void>;

const SUBMIT_LABEL = { idle: 'Submit', sending: 'Sending…', sent: 'Sent', failed: 'Failed' } as const;

/** Hands the changes to `onSubmit` and says how that went, until the changes are different ones. */
function Submit({ changes, literal, onSubmit }: { changes: readonly SchemaChange[]; literal: string; onSubmit: SubmitChanges }) {
  const [last, setLast] = useState<{ changes: readonly SchemaChange[]; state: 'sending' | 'sent' | 'failed' } | null>(null);
  const state = last?.changes === changes ? last.state : 'idle';
  const submit = () => {
    const settle = (to: 'sent' | 'failed') => setLast((cur) => (cur?.changes === changes ? { changes, state: to } : cur));
    setLast({ changes, state: 'sending' });
    // Inside the chain, so a submit that throws fails the same way as one that rejects.
    void Promise.resolve().then(() => onSubmit(changes, literal)).then(() => settle('sent'), () => settle('failed'));
  };
  return (
    <Button size="sm" variant="ghost" disabled={changes.length === 0 || state === 'sending'} onClick={submit}>{SUBMIT_LABEL[state]}</Button>
  );
}

/** The schema as a TypeScript literal beside the list of changes since the baseline. */
export function ExportPanel({ schema, types, changes, onSubmit }: { schema: SchemaRoot; types?: PrefTypes; changes: readonly SchemaChange[]; onSubmit?: SubmitChanges }) {
  const literal = useMemo(() => printSchema(schema, types), [schema, types]);
  const list = useMemo(() => formatChanges(changes) || 'No changes.', [changes]);
  return (
    <div className={s.export}>
      <section className={s.exportPane} aria-label="Literal">
        <PaneHeader title="Literal"><Copy text={literal} /></PaneHeader>
        <CodeBlock code={literal} language="tsx" className={s.code} data-testid="schema-literal" />
      </section>
      <section className={s.exportPane} aria-label="Changes">
        <PaneHeader title="Changes">
          {/* First: its label changes width, and the header's tools sit against the far edge. */}
          {onSubmit && <Submit changes={changes} literal={literal} onSubmit={onSubmit} />}
          <Copy text={list} />
        </PaneHeader>
        <pre className={`${s.code} ${s.changeList}`}>{list}</pre>
      </section>
    </div>
  );
}
