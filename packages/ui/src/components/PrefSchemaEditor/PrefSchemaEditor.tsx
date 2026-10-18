import { useMemo, useState, type ReactNode } from 'react';
import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import type { PrefRenderer } from '../Prefs';
import type { PropertyRenderer } from '../SelectionPanel';
import { NO_CATALOG } from './actionCatalog';
import { AssetEditor } from './AssetEditor';
import type { DraftStorage } from './draft';
import { useEditorActions, type EditorAction } from './editorActions';
import type { PrefSchemaEditorPrefs } from './editorPrefs';
import type { SubmitChanges } from './ExportPanel';
import type { CustomKinds } from './kindSchemas';
import { asWorkspace, catalogIn, ONE, oneAssetCodec, sameSchema, schemaOf } from './oneAsset';
import { printSchema } from './schemaExport';
import { NO_TYPES, type PrefTypes } from './types';
import type { SentAsset } from './useAssetChanges';
import type { Workspace } from './workspace';

/** Props for {@link PrefSchemaEditor}. */
export interface PrefSchemaEditorProps<S extends PrefGroup | PrefSection = PrefGroup> {
  /** A preferences schema, or a node's property schema. */
  schema: S;
  onChange(next: NoInfer<S>): void;
  /** Baseline for the change list and the changed-row marks. Default: the first `schema` seen. */
  original?: NoInfer<S>;
  /** Attribute schemas for custom kinds, by kind. A leaf of an unlisted custom kind edits its base fields only. */
  kinds?: CustomKinds;
  /** The types the editor may place: leaves made with `prefType`. Each is offered by name beside the kinds, for a
   *  pref and for the entry of a list or a map. A leaf made from one is a single row in the tree, edits only what
   *  its use sets (its key, name, description, default, and flags), and prints as the type's name, which the
   *  reader imports where the literal is pasted. An `object` leaf with no type keeps its editable children; a
   *  `union` comes only from a type. */
  types?: PrefTypes;
  /** Renderers for custom kinds, used by a preferences schema's preview and by a custom kind's attributes. */
  renderers?: Record<string, PrefRenderer>;
  /** Renderers for a node property schema's preview, as `SelectionPanel` takes them. */
  propertyRenderers?: Record<string, PropertyRenderer>;
  /** Nodes that have no place in the schema yet, each whole already: its key, name, description and default. They
   *  are listed under the structure tree, to be dragged into it or onto the live preview, and one leaves the list
   *  once the schema holds a leaf of its key. Nested groups are drawn as branches and drag in whole. */
  unplaced?: PrefGroup;
  /** The actions a pref may fire, listed in the shelf under a group for each part of their key's path, to be
   *  dragged into the structure: each lands as an `action` pref that fires it by key. A row picked there shows
   *  its attributes. Left out, the editor lists what the `ActionsRegistry` above it can fire from a button, and
   *  with no registry it lists none. A pref firing a key not among them is marked in the tree. The reader sorts
   *  and groups the list by dragging its rows, which is kept in `actionCatalog`. */
  actions?: readonly EditorAction[];
  /** The catalog the Actions list is sorted and grouped in, as `actionCatalog()` starts one: each action it does not
   *  hold yet is filed into it by its key. Left out, the editor keeps its own, starting empty, so every action is
   *  filed by its key. Either way the reader's sorting is kept in the draft beside the schema, and undoes with it. */
  actionCatalog?: PrefGroup;
  /** Called with the catalog after the reader sorts, groups, or edits the Actions list: what a host keeps to hand
   *  back as `actionCatalog`. */
  onActionCatalogChange?(next: PrefGroup): void;
  /** A name to keep the edited schema under in this browser's `localStorage`, so a reload opens on the edits and
   *  not on `schema`, with the nearest steps still there to undo and redo. Code the schema holds is not stored: it is taken back from the baseline. Give each schema
   *  the editor opens a name of its own. */
  draftKey?: string;
  /** Where the draft under `draftKey` is kept, in place of `localStorage`: a file the host writes, say. It is read
   *  as the editor mounts, so it must already hold what it has. */
  draftStorage?: DraftStorage;
  /** Somewhere to send the changes: given, the Changes pane draws a Submit button that hands over the changes
   *  since `original` and the schema's literal. A promise it returns sets the button to "Sent" or "Failed". */
  onSubmit?: SubmitChanges;
  /** Nothing submitted is still waiting: what `onSubmit` last handed over is in `original` now. Once true, the
   *  editor drops those changes from its draft and keeps the edits made since. */
  taken?: boolean;
  /** What to draw on a node's row in the structure tree, before its kind: a mark the host keeps for some of
   *  the schema's nodes. It is asked by the node's path in `original`, keys joined with dots, so the mark follows
   *  a node the reader moves; a node the reader added has a path `original` does not hold. */
  rowMark?: (original: string) => ReactNode;
  /** The most levels of groups the schema may nest: 1 keeps every group at the top. A drag, a palette drop, or
   *  Add group that would nest deeper is refused. A schema already deeper is shown as it is. Default 2. */
  maxDepth?: number;
  /** Where the editor's own settings are kept: a prefs store the host opens over `PREF_SCHEMA_EDITOR_PREFS`.
   *  Left out, the settings last as long as the editor is mounted. */
  prefs?: PrefSchemaEditorPrefs;
  /** The host's own controls, set first in the bar across the editor's top. */
  bar?: ReactNode;
  className?: string;
}

/**
 * An editor for a preferences schema or a node's property schema: its structure as a tree, the selected node's
 * attributes as a form, a live preview of the result (a `PrefsForm` for the first, a `SelectionPanel` over one
 * scratch node for the second), and an export of it as a TypeScript literal and a list of changes. Edits stay in
 * `schema`; nothing is written back to source. Its own edits undo and redo, from its buttons or Mod+Z, Shift+Mod+Z,
 * and Mod+Y anywhere inside it; a `schema` it did not write itself starts the history over, and a `draftKey` keeps the
 * nearest steps with the draft. Swapping `schema` for an
 * unrelated one without remounting keeps the selection, expansion and baseline; give the editor a `key` to start
 * fresh.
 */
export function PrefSchemaEditor<S extends PrefGroup | PrefSection = PrefGroup>({ schema, onChange, original, onSubmit, types = NO_TYPES, actionCatalog, onActionCatalogChange, ...rest }: PrefSchemaEditorProps<S>) {
  const codec = useMemo(() => oneAssetCodec<S>(types), [types]);
  // A catalog is kept only where there are actions to file in it.
  const listed = useEditorActions(rest.actions) !== null;
  const [ownCatalog, setOwnCatalog] = useState(actionCatalog ?? NO_CATALOG);
  const catalog = listed ? actionCatalog ?? ownCatalog : undefined;
  const [firstCatalog] = useState(catalog);
  const workspace = useMemo(() => asWorkspace(schema, catalog), [schema, catalog]);
  const base = useMemo(() => original && asWorkspace(original, firstCatalog), [original, firstCatalog]);
  const change = (next: Workspace) => {
    const sorted = catalogIn(next);
    if (sorted && sorted !== catalog) {
      setOwnCatalog(sorted);
      onActionCatalogChange?.(sorted);
    }
    if (schemaOf(next) !== schema) onChange(schemaOf<S>(next));
  };
  // A submission holds the schema's changes alone: the catalog is the host's through `onActionCatalogChange`.
  const submit = onSubmit && ((sent: readonly SentAsset[]) => {
    const mine = sent.find((a) => a.id === ONE);
    return onSubmit(mine?.changes ?? [], mine?.literal ?? printSchema(schema, types));
  });
  return <AssetEditor {...rest} types={types} codec={codec} same={sameSchema} workspace={workspace} onChange={change} original={base} onSubmit={submit} />;
}
