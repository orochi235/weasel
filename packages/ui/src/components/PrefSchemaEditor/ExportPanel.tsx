import { useMemo } from 'react';
import { Button } from '../Button';
import { CodeBlock } from '../CodeBlock';
import { PaneHeader } from './PaneHeader';
import type { SchemaRoot } from './schemaEdit';
import { formatChanges, printSchema, type SchemaChange } from './schemaExport';
import s from './PrefSchemaEditor.module.css';

function Copy({ text }: { text: string }) {
  return <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard?.writeText(text).catch(() => {}); }}>Copy</Button>;
}

/** The schema as a TypeScript literal beside the list of changes since the baseline. */
export function ExportPanel({ schema, changes }: { schema: SchemaRoot; changes: readonly SchemaChange[] }) {
  const literal = useMemo(() => printSchema(schema), [schema]);
  const list = useMemo(() => formatChanges(changes) || 'No changes.', [changes]);
  return (
    <div className={s.export}>
      <section className={s.exportPane} aria-label="Literal">
        <PaneHeader title="Literal"><Copy text={literal} /></PaneHeader>
        <CodeBlock code={literal} language="tsx" className={s.code} data-testid="schema-literal" />
      </section>
      <section className={s.exportPane} aria-label="Changes">
        <PaneHeader title="Changes"><Copy text={list} /></PaneHeader>
        <pre className={`${s.code} ${s.changeList}`}>{list}</pre>
      </section>
    </div>
  );
}
