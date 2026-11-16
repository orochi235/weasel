import { useId, useMemo, useState, useSyncExternalStore } from 'react';
import { describeShortcuts, type Action, type ShortcutGroup, type ShortcutRow, type ShortcutTool, type ToolSet } from '@weasel-js/routing';
import { useActionsRegistry } from '@weasel-js/routing/react';
import { formatShortcut, isApplePlatform, type Platform } from '@weasel-js/gestures';
import { Dialog } from '../Dialog';
import { Icon } from '../Icon/Icon';
import { ShortcutKeys } from '../Keycaps';
import { sheetParts, sheetPlatform } from './sheetRows';
import styles from './ShortcutSheet.module.css';

/** Props for {@link ShortcutSheet}. */
export interface ShortcutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tools whose keys it lists, each under its name and glyph. Absent, it lists no tools. */
  tools?: { readonly registry: Readonly<Record<string, ShortcutTool>> } | null;
  /** The sets the tools are grouped by, in order; tools in none follow under "Other tools". Default none, so every
   *  tool is under "Other tools"; a canvas built on editing's tools passes its `BUILTIN_TOOL_GROUPS`. */
  toolSets?: readonly ToolSet[];
  /** Write keys as a Mac's keyboard prints them. Default: whether this is an Apple platform, as the dispatcher reads `mod`. */
  apple?: boolean;
  /** The dialog's heading. Default `"Keyboard shortcuts"`. */
  title?: string;
}

const NO_ACTIONS: readonly Action[] = [];
const NO_SETS: readonly ToolSet[] = [];
const noSubscribe = () => () => {};

function Row({ row, platform }: { row: ShortcutRow; platform: Platform }) {
  return (
    <li className={styles.row}>
      <span className={styles.glyph}>{row.icon && <Icon name={row.icon} />}</span>
      <span className={styles.label}>{row.label}</span>
      <span className={styles.keys}>
        {row.shortcuts.length === 0
          ? <span className={styles.none}>No key</span>
          : row.shortcuts.map((s) => {
            const legend = formatShortcut(s, { platform })!;
            return <ShortcutKeys key={legend} legend={legend} />;
          })}
      </span>
    </li>
  );
}

function Group({ group, platform }: { group: ShortcutGroup; platform: Platform }) {
  const id = useId();
  return (
    <section className={styles.group} aria-labelledby={group.label ? id : undefined}>
      {group.label && <h4 id={id} className={styles.groupTitle}>{group.label}</h4>}
      <ul className={styles.rows}>
        {group.rows.map((r) => <Row key={r.id} row={r} platform={platform} />)}
      </ul>
    </section>
  );
}

/**
 * A dialog listing every key bound in the actions scope around it: each tool's key under its tool set, each command's
 * under its action group, and the keys held to keep something on. Read from the live bindings, so a key rebound or
 * unbound by `bindingOverrides` reads that way, and written by `formatShortcut`. A search finds a row by its name or by
 * a key, written as shown (`⇧⌘Z`) or spelled out (`Cmd+Shift+Z`). Open it from `useShortcutSheetCommand`.
 */
export function ShortcutSheet({
  open, onOpenChange, tools, toolSets = NO_SETS, apple = isApplePlatform(), title = 'Keyboard shortcuts',
}: ShortcutSheetProps) {
  const registry = useActionsRegistry();
  const actions = useSyncExternalStore(
    registry && open ? registry.subscribe : noSubscribe,
    () => (registry && open ? registry.list() : NO_ACTIONS),
  );
  const [query, setQuery] = useState('');
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQuery('');
  }
  const platform = sheetPlatform(apple);
  const registered = tools?.registry;
  const description = useMemo(
    () => describeShortcuts(actions, { ...(registered ? { tools: registered } : {}), toolSets }),
    [actions, registered, toolSets],
  );
  const parts = sheetParts(description, query, platform);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} isDismissable title={title} className={styles.sheet} bodyClassName={styles.body}>
      <input
        className={styles.search}
        type="search"
        placeholder="Search by name or key…"
        aria-label="Search shortcuts"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        autoFocus
      />
      <div className={styles.parts}>
        {parts.length === 0 && <div className={styles.empty}>No matching shortcuts.</div>}
        {parts.map((p) => (
          <section key={p.id} className={styles.part} aria-label={p.label}>
            <h3 className={styles.partTitle}>{p.label}</h3>
            {p.groups.map((g) => <Group key={g.id} group={g} platform={platform} />)}
          </section>
        ))}
      </div>
    </Dialog>
  );
}
