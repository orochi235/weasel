import { useMemo, useState } from 'react';
import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { Code } from '../Code';
import { DetailList, DetailRow } from '../DetailList';
import { Input } from '../Input';
import { PrefsForm, type PrefRenderer } from '../Prefs';
import { prefFieldChoices } from '../Prefs/schema';
import { Select } from '../Select';
import { ATTR_RENDERERS } from './attrRenderers';
import { attributeSchema, changeKind, normalizeAttr, type CustomKinds } from './kindSchemas';
import { childrenOf, holdsFixed, joinPath, keyOf, keyProblem, nodeAt, parentPath, renameKey, setAttribute, takesDottedKey, type SchemaRoot } from './schemaEdit';
import { KEEP, containsCode, printValue } from './schemaExport';
import { PaneHeader } from './PaneHeader';
import s from './PrefSchemaEditor.module.css';

/** Form paths for the rows that are not attributes: the key, the kind, and the kind's own panel. */
const KEY = '$key';
const KIND = '$kind';
const OWN = '$own';
/** Kinds drawn by this pane's own renderers. */
const KEY_KIND = 'schema-key';
const KIND_KIND = 'schema-kind';

export interface AttributesPaneProps {
  schema: SchemaRoot;
  onChange(next: SchemaRoot): void;
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
  // The edited schema's fields, by its own path rule: what a reference in it names.
  const fields = useMemo(() => prefFieldChoices(schema), [schema]);
  const [key, setKey] = useState(path === null ? '' : keyOf(path));
  const [keyError, setKeyError] = useState<string | null>(null);
  const [seen, setSeen] = useState(path);
  if (seen !== path) {
    setSeen(path);
    setKey(path === null ? '' : keyOf(path));
    setKeyError(null);
  }
  if (!node) return <section className={s.pane} aria-label="Attributes"><PaneHeader title="Attributes" /></section>;

  const leaf = isPrefLeaf(node);
  const above = path === null ? undefined : nodeAt(schema, parentPath(path));
  // A list's item is held under a key that is not its to change, and a union's variant is an object and nothing else.
  const keyed = path !== null && !(above && holdsFixed(above));
  const anyKind = leaf && !(above && isPrefLeaf(above) && above.kind === 'union');
  const { shared, own, readOnly } = attributeSchema(node, custom);
  const commitKey = () => {
    if (path === null || key === keyOf(path)) return;
    const parent = parentPath(path);
    const host = nodeAt(schema, parent)!;
    const problem = keyProblem(childrenOf(host) ?? {}, key, takesDottedKey(host, node));
    if (problem) { setKeyError(problem); return; }
    onChange(renameKey(schema, path, key));
    onRekey(path, joinPath(parent, key));
  };

  const identity: Record<string, PrefRenderer> = {
    [KEY_KIND]: () => (
      <Input aria-label="Key" value={key} onChange={setKey} onBlur={commitKey}
        onKeyDown={(e) => { if (e.key === 'Enter') commitKey(); }} errorMessage={keyError ?? undefined} isInvalid={keyError !== null} />
    ),
    [KIND_KIND]: () => leaf && path !== null && (
      <Select aria-label="Kind" selectedKey={node.kind}
        options={kinds.map((k) => ({ value: k, label: k }))}
        onSelectionChange={(k) => {
          const { root, dropped } = changeKind(schema, path, String(k), custom);
          onChange(root);
          onNotice(dropped.length ? `Dropped on kind change: ${dropped.join(', ')}` : null);
        }} />
    ),
  };
  const children: Record<string, PrefLeaf | PrefGroup> = {
    ...(keyed ? { [KEY]: { kind: KEY_KIND, name: 'Key', description: 'The name its value is stored under.', default: '' } as PrefLeaf } : {}),
    ...(anyKind ? { [KIND]: { kind: KIND_KIND, name: 'Kind', description: 'The type of its value, which picks the control that draws it.', default: '' } as PrefLeaf } : {}),
    ...shared,
    ...(Object.keys(own).length > 0 ? { [OWN]: { name: leaf ? node.kind : 'group', children: own } } : {}),
  };

  return (
    <section className={s.pane} aria-label="Attributes">
      <PaneHeader title="Attributes" />
      <PrefsForm
        schema={{ name: 'Attributes', children }}
        layout="list"
        fields={fields}
        values={{ ...node, [OWN]: node }}
        renderers={{ ...renderers, ...ATTR_RENDERERS, ...identity }}
        onChange={(p, value) => {
          const attr = p.startsWith(`${OWN}.`) ? p.slice(OWN.length + 1) : p;
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
