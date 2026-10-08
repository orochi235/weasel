import { useState } from 'react';
import type { ToolPrefGroup } from '@weasel-js/core';
import { Code } from '../Code';
import { DetailList, DetailRow } from '../DetailList';
import { Input } from '../Input';
import { PrefsForm, type PrefRenderer } from '../Prefs';
import { isPrefLeaf } from '../Prefs/schema';
import { Select } from '../Select';
import { ATTR_RENDERERS } from './attrRenderers';
import { attributeSchema, changeKind, normalizeAttr, type CustomKinds } from './kindSchemas';
import { childrenOf, joinPath, keyOf, keyProblem, nodeAt, parentPath, renameKey, setAttribute } from './schemaEdit';
import { KEEP, containsCode, printValue } from './schemaExport';
import s from './PrefSchemaEditor.module.css';

export interface AttributesPaneProps {
  schema: ToolPrefGroup;
  onChange(next: ToolPrefGroup): void;
  path: string | null;
  onRekey(from: string, to: string): void;
  kinds: readonly string[];
  custom: CustomKinds;
  /** Renderers the consumer passes for its own kinds — a custom kind's `default` may need one. */
  renderers?: Record<string, PrefRenderer>;
  onNotice(text: string | null): void;
}

export function AttributesPane({ schema, onChange, path, onRekey, kinds, custom, renderers, onNotice }: AttributesPaneProps) {
  const node = nodeAt(schema, path);
  const [key, setKey] = useState(path === null ? '' : keyOf(path));
  const [keyError, setKeyError] = useState<string | null>(null);
  const [seen, setSeen] = useState(path);
  if (seen !== path) {
    setSeen(path);
    setKey(path === null ? '' : keyOf(path));
    setKeyError(null);
  }
  if (!node) return <section className={s.pane} aria-label="Attributes" />;

  const { schema: attrs, readOnly } = attributeSchema(node, custom);
  const commitKey = () => {
    if (path === null || key === keyOf(path)) return;
    const parent = parentPath(path);
    const problem = keyProblem(childrenOf(nodeAt(schema, parent)!) ?? {}, key);
    if (problem) { setKeyError(problem); return; }
    onChange(renameKey(schema, path, key));
    onRekey(path, joinPath(parent, key));
  };

  return (
    <section className={s.pane} aria-label="Attributes">
      {path !== null && (
        <div className={s.identity}>
          <Input label="Key" orientation="row" value={key} onChange={setKey} onBlur={commitKey}
            onKeyDown={(e) => { if (e.key === 'Enter') commitKey(); }} errorMessage={keyError ?? undefined} isInvalid={keyError !== null} />
          {isPrefLeaf(node) && (
            <Select label="Kind" orientation="row" selectedKey={node.kind}
              options={kinds.map((k) => ({ value: k, label: k }))}
              onSelectionChange={(k) => {
                const { root, dropped } = changeKind(schema, path, String(k), custom);
                onChange(root);
                onNotice(dropped.length ? `Dropped on kind change: ${dropped.join(', ')}` : null);
              }} />
          )}
        </div>
      )}
      {/* One wrapping group: PrefsForm gives each loose top-level leaf a column of its own. */}
      <PrefsForm
        schema={{ name: 'Attributes', children: { attrs: { ...attrs, name: isPrefLeaf(node) ? node.kind : 'group' } } }}
        values={{ attrs: node }}
        renderers={{ ...renderers, ...ATTR_RENDERERS }}
        onChange={(p, value) => {
          const attr = p.slice('attrs.'.length);
          onChange(setAttribute(schema, path, attr, normalizeAttr(attr, value)));
        }}
      />
      {readOnly.length > 0 && (
        <DetailList>
          {readOnly.map(([k, v]) => (
            <DetailRow key={k} label={k}>
              <Code size="xs" status="muted">{containsCode(v) ? `${KEEP} (code)` : printValue(v).replace(/\s*\n\s*/g, ' ')}</Code>
            </DetailRow>
          ))}
        </DetailList>
      )}
    </section>
  );
}
