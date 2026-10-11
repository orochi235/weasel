import { useMemo, useRef, useState } from 'react';
import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { Code } from '../Code';
import { DetailList, DetailRow } from '../DetailList';
import { Input } from '../Input';
import { PrefsForm, type PrefRenderer } from '../Prefs';
import { prefFieldChoices } from '../Prefs/schema';
import { Select } from '../Select';
import { ATTR_RENDERERS } from './attrRenderers';
import { attributeSchema, changeKind, convertLeaf, entryOf, leafOf, normalizeAttr, type CustomKinds } from './kindSchemas';
import { childrenOf, joinPath, keyFromName, keyOf, keyProblem, nodeAt, parentPath, renameKey, setAttribute, takesDottedKey, uniqueKey, type SchemaRoot } from './schemaEdit';
import { choiceOf, entryChoices, kindChoices, typeNamed, type PrefTypes } from './types';
import { KEEP, STUB, containsCode, printValue } from './schemaExport';
import { PaneHeader } from './PaneHeader';
import s from './PrefSchemaEditor.module.css';

/** Form paths for the rows that are not attributes: the key, the kind, and the kind's own panel. */
const KEY = '$key';
const KIND = '$kind';
const OWN = '$own';
const AUTO = '$auto';
const AUTO_VALUE = `${AUTO}.autoValue`;
/** The panel for a list's or a map's entry, which draws the fields of the leaf in `item`. */
const ENTRY = '$entry';
const ENTRY_IS = `${ENTRY}.$kind`;
/** The attribute panels, each drawing the node's own fields under its path. */
const PANELS = [OWN, AUTO];
const UNSET_AUTO_VALUE: ReadonlySet<string> = new Set([AUTO_VALUE]);
/** Kinds drawn by this pane's own renderers. */
const KEY_KIND = 'schema-key';
const KIND_KIND = 'schema-kind';
const NAME_KIND = 'schema-name';
const ENTRY_KIND = 'schema-entry-kind';

export interface AttributesPaneProps {
  schema: SchemaRoot;
  onChange(next: SchemaRoot): void;
  path: string | null;
  onRekey(from: string, to: string): void;
  /** The node at `path` is not in the baseline, so nothing is stored under its key yet. */
  added?: boolean;
  kinds: readonly string[];
  custom: CustomKinds;
  /** The types a leaf, or a list's or a map's entry, may be made from. */
  types: PrefTypes;
  /** Renderers the consumer passes for its own kinds — a custom kind's `default` may need one. */
  renderers?: Record<string, PrefRenderer>;
  onNotice(text: string | null): void;
}

export function AttributesPane({ schema, onChange, path, onRekey, added = false, kinds, custom, types, renderers, onNotice }: AttributesPaneProps) {
  const node = nodeAt(schema, path);
  const nameAtFocus = useRef('');
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
  const keyed = path !== null;
  const { shared, own, auto, entry, readOnly } = attributeSchema(node, custom);
  const item = isPrefLeaf(node) ? entryOf(node) : undefined;
  const held = node as unknown as Record<string, unknown>;
  const setEntry = (next: PrefLeaf) => onChange(setAttribute(schema, path, 'item', next));
  const noAutoValue = held.autoValue === undefined;
  const attrOf = (p: string): string => {
    const panel = PANELS.find((k) => p.startsWith(`${k}.`));
    return panel === undefined ? p : p.slice(panel.length + 1);
  };
  const commitKey = () => {
    if (path === null || key === keyOf(path)) return;
    const parent = parentPath(path);
    const host = nodeAt(schema, parent)!;
    const problem = keyProblem(childrenOf(host) ?? {}, key, takesDottedKey(host, node));
    if (problem) { setKeyError(problem); return; }
    onChange(renameKey(schema, path, key));
    onRekey(path, joinPath(parent, key));
  };

  // A key something may be stored under is left alone unless it was following the name already.
  const followName = () => {
    if (path === null || !keyed) return;
    const parent = parentPath(path);
    const host = nodeAt(schema, parent)!;
    const current = keyOf(path);
    const next = keyFromName(node.name);
    if (takesDottedKey(host, node) || next === '' || next === current) return;
    if (!added && current !== keyFromName(nameAtFocus.current)) return;
    const unique = uniqueKey(childrenOf(host) ?? {}, next);
    onChange(renameKey(schema, path, unique));
    onRekey(path, joinPath(parent, unique));
  };

  const identity: Record<string, PrefRenderer> = {
    [NAME_KIND]: ({ value, setValue }) => (
      <Input aria-label="Name" value={String(value ?? '')} onChange={setValue}
        onFocus={() => { nameAtFocus.current = node.name; }} onBlur={followName} />
    ),
    [KEY_KIND]: () => (
      <Input aria-label="Key" className={s.symbol} value={key} onChange={setKey} onBlur={commitKey}
        onKeyDown={(e) => { if (e.key === 'Enter') commitKey(); }} errorMessage={keyError ?? undefined} isInvalid={keyError !== null} />
    ),
    [KIND_KIND]: () => isPrefLeaf(node) && path !== null && (
      <Select aria-label="Kind" selectedKey={choiceOf(node)}
        options={kindChoices(kinds, types, node)}
        onSelectionChange={(k) => {
          const { root, dropped } = changeKind(schema, path, String(k), custom, types);
          onChange(root);
          onNotice(dropped.length ? `Dropped on kind change: ${dropped.join(', ')}` : null);
        }} />
    ),
    [ENTRY_KIND]: () => item && (
      <Select aria-label="Entry kind" selectedKey={choiceOf(item)}
        options={entryChoices(types, item)}
        onSelectionChange={(k) => {
          const choice = String(k);
          // A type comes as it was declared, its own name for one entry included.
          const { leaf: next, dropped } = typeNamed(choice) !== undefined ? { leaf: leafOf(choice, types), dropped: [] } : convertLeaf(item, choice, custom, types);
          setEntry(next);
          onNotice(dropped.length ? `Dropped from the entry on kind change: ${dropped.join(', ')}` : null);
        }} />
    ),
  };
  const children: Record<string, PrefLeaf | PrefGroup> = {
    // First, so the key under it can follow it.
    ...(shared.name ? { name: { ...shared.name, kind: NAME_KIND } as PrefLeaf } : {}),
    ...(keyed ? { [KEY]: { kind: KEY_KIND, name: 'Key', description: 'The name its value is stored under.', default: '' } as PrefLeaf } : {}),
    ...(leaf ? { [KIND]: { kind: KIND_KIND, name: 'Kind', description: 'The type of its value, which picks the control that draws it.', default: '' } as PrefLeaf } : {}),
    ...Object.fromEntries(Object.entries(shared).filter(([k]) => k !== 'name')),
    ...(Object.keys(own).length > 0 ? { [OWN]: { name: leaf ? node.kind : 'group', children: own } } : {}),
    ...(item && Object.keys(entry).length > 0 ? {
      [ENTRY]: {
        name: 'Entry',
        children: {
          $kind: { kind: ENTRY_KIND, name: 'Kind', description: 'What each entry is: a kind one control edits, or a type declared in code.', default: '' } as PrefLeaf,
          ...entry,
        },
      },
    } : {}),
    ...(Object.keys(auto).length > 0 ? { [AUTO]: { name: 'Auto', children: auto } } : {}),
  };

  return (
    <section className={s.pane} aria-label="Attributes">
      <PaneHeader title="Attributes" />
      <PrefsForm
        schema={{ name: 'Attributes', children }}
        layout="list"
        fields={fields}
        // An unset auto value shows the default it would start from.
        values={{ ...node, [OWN]: node, [ENTRY]: item, [AUTO]: noAutoValue ? { ...node, autoValue: held.default } : node }}
        auto={noAutoValue ? UNSET_AUTO_VALUE : undefined}
        canInherit={(p) => p === AUTO_VALUE}
        inheritHint={() => 'not set'}
        onAutoChange={(p, next) => onChange(setAttribute(schema, path, attrOf(p), next ? undefined : held.default))}
        renderers={{ ...renderers, ...ATTR_RENDERERS, ...identity }}
        onChange={(p, value) => {
          if (item && p.startsWith(`${ENTRY}.`) && p !== ENTRY_IS) {
            const attr = p.slice(ENTRY.length + 1);
            const next: Record<string, unknown> = { ...item, [attr]: normalizeAttr(attr, value) };
            if (next[attr] === undefined) delete next[attr];
            setEntry(next as unknown as PrefLeaf);
            return;
          }
          const attr = attrOf(p);
          onChange(setAttribute(schema, path, attr, normalizeAttr(attr, value)));
        }}
      />
      {readOnly.length > 0 && (
        <DetailList>
          {readOnly.map(([k, v]) => (
            <DetailRow key={k} label={k}>
              <Code size="xs" status="muted">{containsCode(v) && v !== STUB ? `${KEEP} (code)` : printValue(v).replace(/\s*\n\s*/g, ' ')}</Code>
            </DetailRow>
          ))}
        </DetailList>
      )}
    </section>
  );
}
