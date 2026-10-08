import { useMemo } from 'react';
import type { ToolPrefGroup } from '@weasel-js/core';
import { Button } from '../Button';
import { Tab, TabList, TabPanel, Tabs } from '../Tabs';
import { formatChanges, printSchema, type SchemaChange } from './schemaExport';
import s from './PrefSchemaEditor.module.css';

function Copy({ text }: { text: string }) {
  return <Button size="sm" onClick={() => { void navigator.clipboard?.writeText(text).catch(() => {}); }}>Copy</Button>;
}

export function ExportPanel({ schema, changes }: { schema: ToolPrefGroup; changes: readonly SchemaChange[] }) {
  const literal = useMemo(() => printSchema(schema), [schema]);
  const list = useMemo(() => formatChanges(changes) || 'No changes.', [changes]);
  return (
    <Tabs className={s.export}>
      <TabList aria-label="Export">
        <Tab id="literal">Literal</Tab>
        <Tab id="changes">Changes</Tab>
      </TabList>
      <TabPanel id="literal">
        <Copy text={literal} />
        <pre className={s.code} data-testid="schema-literal">{literal}</pre>
      </TabPanel>
      <TabPanel id="changes">
        <Copy text={list} />
        <pre className={s.code}>{list}</pre>
      </TabPanel>
    </Tabs>
  );
}
