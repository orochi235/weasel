import { useMemo, type ReactElement } from 'react';
import { getOwn } from '@weasel-js/registry';
import { isPrefLeaf, type PrefLeaf, type PrefList, type PrefMap } from '@weasel-js/prefs';
import { Code, DetailList, DetailRow, type LeafRenderer, renderPrefControl } from '@weasel-js/ui';
import {
  aggregateAttributes, type AutoRow, catalogAttributes, changeKind, choiceOf, CONDITION_KIND, containsCode, convertLeaf,
  type CustomKinds, entryChoices, entryOf, isObjectField, KEEP, keyOf, keysOf, kindChoices, leafOf, normalizeAttr, parentPath,
  aliasAttributes, type PrefTypes, printValue, type SchemaRoot, setAttribute, setAutoRow, setObjectField, STUB, typeNamed,
} from '@weasel-js/prefs/edit';
import {
  attrOf, AUTO, AUTO_VALUE_KIND, ENTRY, ENTRY_IS, ENTRY_KIND, formRowsFor, KEY_KIND, KIND_KIND, markedRowsFor, mixedRowsFor,
  NAME_KIND, OWN, PATH_KIND,
} from './attributeForm';
import { followedKeyFor, keyProblemFor, useKeyDraft } from './attributeKey';
import { conditionRenderer, keyRenderer, kindPickerRenderer, nameRenderer } from './attributeRenderers';
import { autoValueRenderer } from './autoValueRenderer';
import { ATTR_RENDERERS } from './attrRenderers';
import type { EditorAction } from './editorActions';
import { PaneHeader } from './PaneHeader';
import { useSelectedNodes } from './useSelectedNodes';
import { IdentityForm } from './IdentityForm';
import { nodeIcon } from './nodeIcon';
import s from './PrefSchemaEditor.module.css';

const NONE: ReadonlySet<string> = new Set();

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
  renderers?: Record<string, LeafRenderer>;
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

/** The attributes shown and not edited, each value printed on one line. */
function ReadOnlyAttributes({ entries }: { entries: ReadonlyArray<[string, unknown]> }) {
  if (entries.length === 0) return null;
  return (
    <DetailList>
      {entries.map(([k, v]) => (
        <DetailRow key={k} label={k}>
          <Code size="xs" emphasis="low">{containsCode(v) && v !== STUB ? `${KEEP} (code)` : printValue(v).replace(/\s*\n\s*/g, ' ')}</Code>
        </DetailRow>
      ))}
    </DetailList>
  );
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
    return catalog ? catalogAttributes(all) : pointers ? { ...all, schema: aliasAttributes(all.schema) } : all;
  }, [nodes, custom, actions, pointers, catalog]);
  const mixedPaths = useMemo(() => mixedRowsFor(agg), [agg]);
  const keyDraft = useKeyDraft(path);
  if (agg === null || nodes.length !== targets.length) return <section className={s.pane} aria-label="Attributes"><PaneHeader title="Attributes" /></section>;

  const node = nodes[0]!;
  // A pointer is what it points at: its key stores nothing.
  const leaf = agg.kind !== undefined && over === undefined && !catalog;
  const keyed = !several && path !== null && !pointers && !catalog;
  const { own, auto, entry, readOnly } = agg.schema;
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
  const commitKey = () => {
    if (path === null || keyDraft.key === keyOf(path)) return;
    const problem = keyProblemFor(schema, path, node, keyDraft.key);
    if (problem) { keyDraft.setError(problem); return; }
    onRename(path, keyDraft.key);
  };
  // Only a node added since the baseline follows its name: values may be stored under any other's key.
  const followName = () => {
    if (path === null || !keyed || !added) return;
    const next = followedKeyFor(schema, path, node);
    if (next !== null) onRename(path, next);
  };
  const setKinds = (kind: string) => {
    const dropped = new Set<string>();
    const next = targets.reduce<SchemaRoot>((root, p) => {
      const made = changeKind(root, p!, kind, custom, types);
      for (const d of made.dropped) dropped.add(d);
      return made.root;
    }, schema);
    onChange(next);
    onNotice(dropped.size ? `Dropped on kind change: ${[...dropped].join(', ')}` : null);
  };
  const setEntryKind = (kind: string) => {
    // A type comes as it was declared, its own name for one entry included.
    const { leaf: next, dropped } = typeNamed(kind) !== undefined ? { leaf: leafOf(kind, types), dropped: [] } : convertLeaf(item!, kind, custom, types);
    setEntry(next);
    onNotice(dropped.length ? `Dropped from the entry on kind change: ${dropped.join(', ')}` : null);
  };

  const drawn = { ...renderers, ...ATTR_RENDERERS };
  const identity: Record<string, LeafRenderer> = {
    [AUTO_VALUE_KIND]: autoValueRenderer(noAutoValue, (on) => writeAuto('value', on ? held.default : undefined),
      (ctx) => renderPrefControl({ ...ctx, pref: auto.value! }, drawn)),
    [CONDITION_KIND]: conditionRenderer(schema, ownPaths, item ? (node as PrefList | PrefMap) : undefined, targets, over),
    [NAME_KIND]: nameRenderer(several ? undefined : followName),
    [KEY_KIND]: keyRenderer(keyDraft, commitKey),
    [PATH_KIND]: () => <span className={s.pathText}>{keysOf(path).join('.')}</span>,
    [KIND_KIND]: kindPickerRenderer('Kind', choice, isPrefLeaf(node) && leaf ? kindChoices(kinds, types, node) : null, setKinds),
    [ENTRY_KIND]: kindPickerRenderer('Entry kind', item ? choiceOf(item) : null, item ? entryChoices(types, item) : null, setEntryKind),
  };

  return (
    <section className={s.pane} aria-label="Attributes">
      <PaneHeader title={several ? `${targets.length} selected` : 'Attributes'} />
      <Lockable locked={locked}>
      <IdentityForm icon={several ? null : nodeIcon(node, path !== null && parentPath(path) === null, actions)}
        schema={{ name: 'Attributes', children: formRowsFor(agg.schema, { keyed, leaf, entry: item !== undefined, kind: agg.kind }) }}
        layout="list" fields={fields}
        changed={markedRowsFor(changed, agg.schema)}
        values={{ ...held, [OWN]: held, [ENTRY]: item, [AUTO]: noAutoValue ? { ...autoHeld, value: held.default } : autoHeld }}
        mixed={mixedPaths}
        renderers={{ ...drawn, ...identity }}
        onChange={(p, value) => {
          if (item && p.startsWith(`${ENTRY}.`) && p !== ENTRY_IS) {
            const attr = p.slice(ENTRY.length + 1);
            const next: Record<string, unknown> = { ...item, [attr]: normalizeAttr(attr, value, getOwn(entry, attr)) };
            if (getOwn(next, attr) === undefined) delete next[attr];
            setEntry(next as unknown as PrefLeaf);
            return;
          }
          if (p.startsWith(`${AUTO}.`)) { writeAuto(attrOf(p) as AutoRow, value); return; }
          const attr = attrOf(p);
          if (isObjectField(agg.schema, attr)) onChange(setObjectField(schema, targets, attr, value)); else writeAll(attr, normalizeAttr(attr, value, getOwn(own, attr)));
        }}
      />
      </Lockable>
      <ReadOnlyAttributes entries={readOnly} />
    </section>
  );
}
