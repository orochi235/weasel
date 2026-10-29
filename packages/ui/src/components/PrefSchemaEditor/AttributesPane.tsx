import { useMemo, useState, type ReactElement } from 'react';
import { isPrefLeaf, type PrefCondition, type PrefGroup, type PrefLeaf, type PrefList, type PrefMap } from '@weasel-js/prefs';
import { Code } from '../Code';
import { DetailList, DetailRow } from '../DetailList';
import { Input } from '../Input';
import { PrefConditionEditor } from '../PrefConditionEditor';
import type { PrefRenderer } from '../Prefs';
import { renderPrefControl } from '../Prefs/PrefsRow';
import { Select } from '../Select';
import { aggregateAttributes, catalogAttributes, isObjectField, setAutoRow, setObjectField } from './attrAggregate';
import type { AutoRow } from './autoRows';
import { autoValueRenderer } from './autoValueRenderer';
import { ATTR_RENDERERS } from './attrRenderers';
import type { EditorAction } from './editorActions';
import { changeKind, CONDITION_KIND, convertLeaf, entryOf, leafOf, normalizeAttr, type CustomKinds } from './kindSchemas';
import { entryHolderAt, keyFromName, keyOf, keyProblem, keysOf, keysTakenAt, nodeAt, parentPath, setAttribute, takesDottedKey, uniqueKey, type SchemaRoot } from './schemaEdit';
import { choiceOf, entryChoices, kindChoices, typeNamed, type PrefTypes } from './types';
import { KEEP, STUB, containsCode, printValue } from './schemaExport';
import { PaneHeader } from './PaneHeader';
import { pointerAttributes } from './pointers';
import { useSelectedNodes } from './useSelectedNodes';
import { IdentityForm } from './IdentityForm';
import { nodeIcon } from './nodeIcon';
import s from './PrefSchemaEditor.module.css';

/** Form paths for the rows that are not attributes: the key, the kind, and the kind's own panel. */
const KEY = '$key';
const PATH = '$path';
const KIND = '$kind';
const OWN = '$own';
const AUTO = '$auto';
/** The panel for a list's or a map's entry, which draws the fields of the leaf in `item`. */
const ENTRY = '$entry';
const ENTRY_IS = `${ENTRY}.$kind`;
/** The attribute panels, each drawing the node's own fields under its path. */
const PANELS = [OWN, AUTO];
const NONE: ReadonlySet<string> = new Set();
/** Kinds drawn by this pane's own renderers. */
const KEY_KIND = 'schema-key';
const PATH_KIND = 'schema-path';
const KIND_KIND = 'schema-kind';
const NAME_KIND = 'schema-name';
const ENTRY_KIND = 'schema-entry-kind';
const AUTO_VALUE_KIND = 'schema-auto-value';

/** Every attribute whose values disagree is drawn with none, and an edit to it is written over them all. An object is split, so the fields that agree keep their values. */
const drawsMixed = (kind: string): boolean => kind !== 'object';

/** `children` with every control in it disabled while `locked`: the form has no read-only mode of its own. */
function Lockable({ locked, children }: { locked: boolean; children: ReactElement }) {
  return locked ? <fieldset className={s.lockedForm} disabled>{children}</fieldset> : children;
}

export interface AttributesPaneProps {
  schema: SchemaRoot;
  onChange(next: SchemaRoot): void;
  /** The nodes to edit together; none is the root. */
  paths: readonly string[];
  /** Put the node at `path` under `key`. The host does it, since what else names the node has to follow. */
  onRename(path: string, key: string): void;
  /** The one node selected is not in the baseline, so nothing is stored under its key yet. */
  added?: boolean;
  /** The one selected node's attributes that differ from the baseline's, by name; `$key` for its key. Their rows are marked. */
  changed?: ReadonlySet<string>;
  kinds: readonly string[];
  custom: CustomKinds;
  /** The types a leaf, or a list's or a map's entry, may be made from. */
  types: PrefTypes;
  /** The actions an action pref may fire, offered as its `action` attribute's choices. */
  actions?: readonly EditorAction[];
  /** Renderers the consumer passes for its own kinds — a custom kind's `default` may need one. */
  renderers?: Record<string, PrefRenderer>;
  /** The dialog a layout's pointers name settings in. Given, an alias is a pointer: its form offers only where it points, among that
   *  dialog's settings. No leaf of a layout is offered another kind, which could make a setting of it. */
  over?: SchemaRoot;
  /** The schema is the catalog of the host's actions: a node's form offers what a pref dragged out of it carries,
   *  and lists what its action brings. Its key and its kind are the catalog's own to keep. */
  catalog?: boolean;
  /** The schema takes no edit: the form shows what the nodes hold, with every control disabled. */
  readOnly?: boolean;
  onNotice(text: string | null): void;
}

/**
 * Draws a `showIf` or an `enableIf` as its editor. `holder` is the selected list or map: the condition of its
 * entry may read the entry's own fields, where the node's own reads the schema's. A node at one of `targets` that is
 * a field of an entry may read that entry's other fields, where every target is a field of the same one.
 */
function conditionRenderer(schema: SchemaRoot, exclude: readonly string[], holder: PrefList | PrefMap | undefined, targets: ReadonlyArray<string | null>, over: SchemaRoot | undefined): PrefRenderer {
  const holders = targets.map((p) => entryHolderAt(schema, p));
  const within = holders.every((h) => h === holders[0]) ? holders[0] : undefined;
  return Object.assign<PrefRenderer, { group: boolean; wide: boolean }>(({ path, pref, value, setValue }) => {
    const ofEntry = path.startsWith(`${ENTRY}.`);
    const entryOf = ofEntry ? holder : within;
    return (
      <PrefConditionEditor aria-label={ofEntry ? `Entry ${pref.name.toLowerCase()}` : pref.name} schema={schema} over={over} exclude={exclude}
        entryOf={entryOf} value={value as PrefCondition | undefined} onChange={setValue} />
    );
  }, { group: true, wide: true });
}

export function AttributesPane({ schema, onChange, paths, onRename, added = false, changed = NONE, kinds, custom, types, actions, renderers, over, catalog = false, readOnly: locked = false, onNotice }: AttributesPaneProps) {
  const targets: ReadonlyArray<string | null> = useMemo(() => (paths.length === 0 ? [null] : paths), [paths]);
  const several = targets.length > 1;
  // The key, a key that follows the name, and a list's entry belong to one node.
  const path = several ? null : targets[0]!;
  const { nodes, ownPaths, fields } = useSelectedNodes(schema, targets, over);
  const pointers = over !== undefined && nodes.length > 0 && nodes.every((n) => isPrefLeaf(n) && n.kind === 'alias');
  const agg = useMemo(() => {
    if (nodes.length === 0) return null;
    const all = aggregateAttributes(nodes, custom, drawsMixed, actions);
    return catalog ? catalogAttributes(all) : pointers ? { ...all, schema: pointerAttributes(all.schema) } : all;
  }, [nodes, custom, actions, pointers, catalog]);
  const mixedPaths = useMemo(
    () => new Set([...[...(agg?.mixed ?? [])].flatMap((k) => [k, `${OWN}.${k}`]), ...[...(agg?.auto.mixed ?? [])].map((k) => `${AUTO}.${k}`)]),
    [agg],
  );
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
  // A pointer is what it points at: its key stores nothing.
  const leaf = agg.kind !== undefined && over === undefined && !catalog;
  const keyed = !several && path !== null && !pointers && !catalog;
  const { shared, own, auto, entry, readOnly } = agg.schema;
  const item = !several && isPrefLeaf(node) ? entryOf(node) : undefined;
  const held = agg.values;
  const setEntry = (next: PrefLeaf) => onChange(setAttribute(schema, path, 'item', next));
  const autoHeld = agg.auto.values;
  const noAutoValue = !agg.auto.mixed.has('value') && autoHeld.value === undefined;
  /** One attribute set on every node, as one edit. */
  const writeAll = (attr: string, value: unknown) =>
    onChange(targets.reduce<SchemaRoot>((root, p) => setAttribute(root, p, attr, value), schema));
  const writeAuto = (row: AutoRow, value: unknown) => onChange(setAutoRow(schema, targets, row, value));
  // What each leaf is, as the Kind picker names it: one choice when they agree.
  const choices = nodes.map((n) => (isPrefLeaf(n) ? choiceOf(n) : null));
  const choice = choices.every((c) => c === choices[0]) ? choices[0]! : null;
  const attrOf = (p: string): string => {
    const panel = PANELS.find((k) => p.startsWith(`${k}.`));
    return panel === undefined ? p : p.slice(panel.length + 1);
  };
  const commitKey = () => {
    if (path === null || key === keyOf(path)) return;
    const parent = parentPath(path);
    const host = nodeAt(schema, parent)!;
    const problem = keyProblem(keysTakenAt(schema, parent, isPrefLeaf(node)), key, takesDottedKey(host, node));
    if (problem) { setKeyError(problem); return; }
    onRename(path, key);
  };

  // Only a node added since the baseline follows its name: values may be stored under any other's key.
  const followName = () => {
    if (path === null || !keyed || !added) return;
    const parent = parentPath(path);
    const host = nodeAt(schema, parent)!;
    const current = keyOf(path);
    const next = keyFromName(node.name);
    if (takesDottedKey(host, node) || next === '' || next === current) return;
    const unique = uniqueKey(keysTakenAt(schema, parent, isPrefLeaf(node)), next);
    onRename(path, unique);
  };

  const drawn = { ...renderers, ...ATTR_RENDERERS };
  const identity: Record<string, PrefRenderer> = {
    [AUTO_VALUE_KIND]: autoValueRenderer(noAutoValue, (on) => writeAuto('value', on ? held.default : undefined),
      (ctx) => renderPrefControl({ ...ctx, pref: auto.value! }, drawn)),
    [CONDITION_KIND]: conditionRenderer(schema, ownPaths, item ? (node as PrefList | PrefMap) : undefined, targets, over),
    [NAME_KIND]: ({ value, mixed, setValue }) => (
      <Input aria-label="Name" value={String(value ?? '')} mixed={mixed} onChange={setValue}
        onBlur={several ? undefined : followName} />
    ),
    [KEY_KIND]: () => (
      <Input aria-label="Key" className={s.symbol} value={key} onChange={setKey} onBlur={commitKey}
        onKeyDown={(e) => { if (e.key === 'Enter') commitKey(); }} errorMessage={keyError ?? undefined} isInvalid={keyError !== null} />
    ),
    [PATH_KIND]: () => <span className={s.pathText}>{keysOf(path).join('.')}</span>,
    [KIND_KIND]: () => isPrefLeaf(node) && leaf && (
      <Select aria-label="Kind" selectedKey={choice} mixed={choice === null}
        options={kindChoices(kinds, types, node)}
        onSelectionChange={(k) => {
          const dropped = new Set<string>();
          const next = targets.reduce<SchemaRoot>((root, p) => {
            const made = changeKind(root, p!, String(k), custom, types);
            for (const d of made.dropped) dropped.add(d);
            return made.root;
          }, schema);
          onChange(next);
          onNotice(dropped.size ? `Dropped on kind change: ${[...dropped].join(', ')}` : null);
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
    // First, the name and what it says, which a node's glyph stands beside; the key follows the name from under them.
    ...(shared.name ? { name: { ...shared.name, kind: NAME_KIND } as PrefLeaf } : {}),
    ...(shared.description ? { description: shared.description } : {}),
    ...(keyed ? { [KEY]: { kind: KEY_KIND, name: 'Key', description: 'The name its value is stored under.', default: '' } as PrefLeaf } : {}),
    ...(keyed ? { [PATH]: { kind: PATH_KIND, name: 'Path', description: 'Where its value is stored: its key, under the key of each group around it.', default: '' } as PrefLeaf } : {}),
    ...(leaf ? { [KIND]: { kind: KIND_KIND, name: 'Kind', description: 'The type of value it holds, which decides the control that edits it.', default: '' } as PrefLeaf } : {}),
    ...Object.fromEntries(Object.entries(shared).filter(([k]) => k !== 'name' && k !== 'description')),
    ...(Object.keys(own).length > 0 ? { [OWN]: { name: agg.kind === undefined ? 'group' : agg.kind ?? 'Common', children: own } } : {}),
    ...(item && Object.keys(entry).length > 0 ? {
      [ENTRY]: {
        name: 'Entry',
        children: {
          $kind: { kind: ENTRY_KIND, name: 'Kind', description: 'What each entry is: a plain kind one control edits, or a type declared in code.', default: '' } as PrefLeaf,
          ...entry,
        },
      },
    } : {}),
    ...(Object.keys(auto).length > 0 ? {
      [AUTO]: { name: 'Auto', children: { ...auto, ...(auto.value ? { value: { ...auto.value, kind: AUTO_VALUE_KIND } } : {}) } },
    } : {}),
  };

  // An attribute's row sits at its own name, or under the panel that holds it.
  const marked = new Set([
    ...[...changed].flatMap((attr) => [
      ...(attr in shared || attr === KEY ? [attr] : []),
      ...(attr === 'kind' ? [KIND] : []),
      ...(attr in own ? [`${OWN}.${attr}`] : []),
      // The panel's rows all live in `auto`, so a change to it marks each.
      ...(attr === 'auto' ? Object.keys(auto).map((row) => `${AUTO}.${row}`) : []),
      // What an entry is shows on its picker; any other attribute of it, on that attribute's row.
      ...(attr === 'item' || attr === 'item.kind' || attr === 'item.type' ? [ENTRY_IS] : attr.startsWith('item.') ? [`${ENTRY}.${attr.slice(5)}`] : []),
    ]),
  ]);

  return (
    <section className={s.pane} aria-label="Attributes">
      <PaneHeader title={several ? `${targets.length} selected` : 'Attributes'} />
      <Lockable locked={locked}>
      <IdentityForm icon={several ? null : nodeIcon(node, path !== null && parentPath(path) === null, actions)}
        schema={{ name: 'Attributes', children }}
        layout="list" fields={fields}
        changed={marked}
        values={{ ...held, [OWN]: held, [ENTRY]: item, [AUTO]: noAutoValue ? { ...autoHeld, value: held.default } : autoHeld }}
        mixed={mixedPaths}
        renderers={{ ...drawn, ...identity }}
        onChange={(p, value) => {
          if (item && p.startsWith(`${ENTRY}.`) && p !== ENTRY_IS) {
            const attr = p.slice(ENTRY.length + 1);
            const next: Record<string, unknown> = { ...item, [attr]: normalizeAttr(attr, value, entry[attr]) };
            if (next[attr] === undefined) delete next[attr];
            setEntry(next as unknown as PrefLeaf);
            return;
          }
          if (p.startsWith(`${AUTO}.`)) { writeAuto(attrOf(p) as AutoRow, value); return; }
          const attr = attrOf(p);
          if (isObjectField(agg.schema, attr)) onChange(setObjectField(schema, targets, attr, value)); else writeAll(attr, normalizeAttr(attr, value, own[attr]));
        }}
      />
      </Lockable>
      {readOnly.length > 0 && (
        <DetailList>
          {readOnly.map(([k, v]) => (
            <DetailRow key={k} label={k}>
              <Code size="xs" emphasis="low">{containsCode(v) && v !== STUB ? `${KEEP} (code)` : printValue(v).replace(/\s*\n\s*/g, ' ')}</Code>
            </DetailRow>
          ))}
        </DetailList>
      )}
    </section>
  );
}
