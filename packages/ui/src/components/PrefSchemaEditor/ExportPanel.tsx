import { useMemo, useState } from 'react';
import { Button } from '../Button';
import { CodeBlock } from '../CodeBlock';
import { Tab, TabList, TabPanel, Tabs } from '../Tabs';
import type { AssetExport } from './assetExport';
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

/**
 * The schema as a TypeScript literal, and the list of changes since the baseline, a tab each. `changesText` is the list where
 * `changes` are not this schema's alone: an editor of several assets lists every one's, and submits them all.
 * `exported` is what the asset exports in place of the literal, drawn and submitted as it is: a JSON document has its tab.
 */
export function ExportPanel({ schema, types, exported, changes, changesText, onSubmit }: { schema: SchemaRoot; types?: PrefTypes; exported?: AssetExport; changes: readonly SchemaChange[]; changesText?: string; onSubmit?: SubmitChanges }) {
  const literal = useMemo(() => exported?.text ?? printSchema(schema, types), [exported, schema, types]);
  const json = exported?.language === 'json';
  const list = useMemo(() => (changesText ?? formatChanges(changes)) || 'No changes.', [changes, changesText]);
  const [tab, setTab] = useState<'literal' | 'changes'>('literal');
  return (
    <section className={s.export} aria-label="Export">
    <Tabs className={s.exportBody} selectedKey={tab} onSelectionChange={(key) => setTab(key as typeof tab)}>
      <div className={s.exportHead}>
        <TabList aria-label="Export" className={s.exportTabs}>
          <Tab id="literal" className={s.exportTab}>{json ? 'JSON' : 'Literal'}</Tab>
          <Tab id="changes" className={s.exportTab}>Changes</Tab>
        </TabList>
        <div className={s.paneTools}>
          {/* First: its label changes width, and the head's tools sit against the far edge. */}
          {onSubmit && <Submit changes={changes} literal={literal} onSubmit={onSubmit} />}
          <Copy text={tab === 'literal' ? literal : list} />
        </div>
      </div>
      {/* Both stay mounted, so a tab comes back scrolled to where it was left. */}
      <TabPanel id="literal" shouldForceMount className={s.exportPane}>
        <CodeBlock code={literal} language={exported?.language ?? 'tsx'} className={s.code} data-testid="schema-literal" />
      </TabPanel>
      <TabPanel id="changes" shouldForceMount className={s.exportPane}>
        <pre className={`${s.code} ${s.changeList}`}>{list}</pre>
      </TabPanel>
    </Tabs>
    </section>
  );
}
