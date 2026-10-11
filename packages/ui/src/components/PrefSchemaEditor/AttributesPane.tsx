import { useMemo, useRef, useState } from 'react';
import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { Code } from '../Code';
import { DetailList, DetailRow } from '../DetailList';
import { Input } from '../Input';
import { PrefsForm, type PrefRenderer } from '../Prefs';
import { prefFieldChoices } from '../Prefs/schema';
import { Select } from '../Select';
import { aggregateAttributes, WHOLE } from './attrAggregate';
import { ATTR_RENDERERS, MIXED_ATTR_KINDS, MIXED_HINT } from './attrRenderers';
import { changeKind, normalizeAttr, type CustomKinds } from './kindSchemas';
import { childrenOf, holdsFixed, joinPath, keyFromName, keyOf, keyProblem, nodeAt, parentPath, renameKey, setAttribute, takesDottedKey, uniqueKey, type SchemaNode, type SchemaRoot } from './schemaEdit';
import { KEEP, STUB, containsCode, printValue } from './schemaExport';
import { PaneHeader } from './PaneHeader';
import s from './PrefSchemaEditor.module.css';

/** Form paths for the rows that are not attributes: the key, the kind, and the kind's own panel. */
const KEY = '$key';
const KIND = '$kind';
const OWN = '$own';
const AUTO = '$auto';
const AUTO_VALUE = `${AUTO}.autoValue`;
/** The attribute panels, each drawing the node's own fields under its path. */
const PANELS = [OWN, AUTO];
const UNSET_AUTO_VALUE: ReadonlySet<string> = new Set([AUTO_VALUE]);
/** Kinds drawn by this pane's own renderers. */
const KEY_KIND = 'schema-key';
const KIND_KIND = 'schema-kind';
const NAME_KIND = 'schema-name';

/** Whether an attribute kind's control can stand for several values that disagree. */
const drawsMixed = (kind: string): boolean => (kind in ATTR_RENDERERS ? MIXED_ATTR_KINDS.has(kind) : !WHOLE.has(kind));

export interface AttributesPaneProps {
  schema: SchemaRoot;
  onChange(next: SchemaRoot): void;
  /** The nodes to edit together; none is the root. */
  paths: readonly string[];
  onRekey(from: string, to: string): void;
  /** The one node selected is not in the baseline, so nothing is stored under its key yet. */
  added?: boolean;
  kinds: readonly string[];
  custom: CustomKinds;
  /** Renderers the consumer passes for its own kinds — a custom kind's `default` may need one. */
  renderers?: Record<string, PrefRenderer>;
  onNotice(text: string | null): void;
}

export function AttributesPane({ schema, onChange, paths, onRekey, added = false, kinds, custom, renderers, onNotice }: AttributesPaneProps) {
  const targets: ReadonlyArray<string | null> = useMemo(() => (paths.length === 0 ? [null] : paths), [paths]);
  const several = targets.length > 1;
  // The key, and a key that follows the name, belong to one node.
  const path = several ? null : targets[0]!;
  const nodes = useMemo(
    () => targets.map((p) => nodeAt(schema, p)).filter((n): n is SchemaNode => n !== undefined),
    [schema, targets],
  );
  const agg = useMemo(() => (nodes.length === 0 ? null : aggregateAttributes(nodes, custom, drawsMixed)), [nodes, custom]);
  const mixedPaths = useMemo(
    () => new Set([...(agg?.mixed ?? [])].flatMap((k) => [k, `${OWN}.${k}`, `${AUTO}.${k}`])),
    [agg],
  );
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
  if (agg === null || nodes.length !== targets.length) return <section className={s.pane} aria-label="Attributes"><PaneHeader title="Attributes" /></section>;

  const node = nodes[0]!;
  const leaf = agg.kind !== undefined;
  const aboveOf = (p: string | null) => (p === null ? undefined : nodeAt(schema, parentPath(p)));
  const above = aboveOf(path);
  // A list's item is held under a key that is not its to change, and a union's variant is an object and nothing else.
  const keyed = !several && path !== null && !(above && holdsFixed(above));
  const anyKind = leaf && targets.every((p) => {
    const over = aboveOf(p);
    return !(over && isPrefLeaf(over) && over.kind === 'union');
  });
  const { shared, own, auto, readOnly } = agg.schema;
  const held = agg.values;
  const noAutoValue = !agg.mixed.has('autoValue') && held.autoValue === undefined;
  /** One attribute set on every node, as one edit. */
  const writeAll = (attr: string, value: unknown) =>
    onChange(targets.reduce<SchemaRoot>((root, p) => setAttribute(root, p, attr, value), schema));
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
    [NAME_KIND]: ({ value, mixed, setValue }) => (
      <Input aria-label="Name" value={String(value ?? '')} placeholder={mixed ? MIXED_HINT : undefined} onChange={setValue}
        onFocus={() => { nameAtFocus.current = node.name; }} onBlur={several ? undefined : followName} />
    ),
    [KEY_KIND]: () => (
      <Input aria-label="Key" className={s.symbol} value={key} onChange={setKey} onBlur={commitKey}
        onKeyDown={(e) => { if (e.key === 'Enter') commitKey(); }} errorMessage={keyError ?? undefined} isInvalid={keyError !== null} />
    ),
    [KIND_KIND]: () => leaf && (
      <Select aria-label="Kind" selectedKey={agg.kind ?? null} placeholder={MIXED_HINT}
        options={kinds.map((k) => ({ value: k, label: k }))}
        onSelectionChange={(k) => {
          const dropped = new Set<string>();
          const next = targets.reduce<SchemaRoot>((root, p) => {
            const changed = changeKind(root, p!, String(k), custom);
            for (const d of changed.dropped) dropped.add(d);
            return changed.root;
          }, schema);
          onChange(next);
          onNotice(dropped.size ? `Dropped on kind change: ${[...dropped].join(', ')}` : null);
        }} />
    ),
  };
  const children: Record<string, PrefLeaf | PrefGroup> = {
    // First, so the key under it can follow it.
    ...(shared.name ? { name: { ...shared.name, kind: NAME_KIND } as PrefLeaf } : {}),
    ...(keyed ? { [KEY]: { kind: KEY_KIND, name: 'Key', description: 'The name its value is stored under.', default: '' } as PrefLeaf } : {}),
    ...(anyKind ? { [KIND]: { kind: KIND_KIND, name: 'Kind', description: 'The type of its value, which picks the control that draws it.', default: '' } as PrefLeaf } : {}),
    ...Object.fromEntries(Object.entries(shared).filter(([k]) => k !== 'name')),
    ...(Object.keys(own).length > 0 ? { [OWN]: { name: agg.kind === undefined ? 'group' : agg.kind ?? 'Common', children: own } } : {}),
    ...(Object.keys(auto).length > 0 ? { [AUTO]: { name: 'Auto', children: auto } } : {}),
  };

  return (
    <section className={s.pane} aria-label="Attributes">
      <PaneHeader title={several ? `${targets.length} selected` : 'Attributes'} />
      <PrefsForm
        schema={{ name: 'Attributes', children }}
        layout="list"
        fields={fields}
        // An unset auto value shows the default it would start from.
        values={{ ...held, [OWN]: held, [AUTO]: noAutoValue ? { ...held, autoValue: held.default } : held }}
        mixed={mixedPaths}
        auto={noAutoValue ? UNSET_AUTO_VALUE : undefined}
        canInherit={(p) => p === AUTO_VALUE}
        inheritHint={() => 'not set'}
        onAutoChange={(p, next) => writeAll(attrOf(p), next ? undefined : held.default)}
        renderers={{ ...renderers, ...ATTR_RENDERERS, ...identity }}
        onChange={(p, value) => {
          const attr = attrOf(p);
          writeAll(attr, normalizeAttr(attr, value));
        }}
      />
      {readOnly.length + agg.apart.length > 0 && (
        <DetailList>
          {readOnly.map(([k, v]) => (
            <DetailRow key={k} label={k}>
              <Code size="xs" status="muted">{containsCode(v) && v !== STUB ? `${KEEP} (code)` : printValue(v).replace(/\s*\n\s*/g, ' ')}</Code>
            </DetailRow>
          ))}
          {agg.apart.map((k) => (
            <DetailRow key={k} label={k}><Code size="xs" status="muted">mixed</Code></DetailRow>
          ))}
        </DetailList>
      )}
    </section>
  );
}
