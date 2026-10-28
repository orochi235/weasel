import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIconVariant } from '@weasel-js/core';
import { RegistryBrowser, type RegistryBrowserPick, type RegistryCategory } from '@weasel-js/devtools';
import { Badge } from '@weasel-js/ui/components/Badge';
import { Icon } from '@weasel-js/ui/components/Icon';
import s from './RegistryInspector.module.css';
import { DevShell } from './DevShell';
import { RegistryDetail } from './RegistryDetail';
import { RegistryProbe, type RegistrySnapshot } from './registryProbe';
import { collectBundles, collectGestures, countForEntry, collectIcons, collectMeta, collectPropertiesTrait, collectOpKinds, collectPhaseOutputs, collectShapeTrait, collectSlots } from './registryData';
import type { TreeCategoryNode, TreeEntry } from './registryEntries';
import { icon } from '../icons.gen';

const entryKey = (e: TreeEntry) => `${e.kind}:${e.id}`;

/** Parse the selected-entry coordinates out of the URL hash. The inspector
 *  encodes the user's selection as `#/dev/registry?kind=<entryKind>&id=<entryId>`
 *  so a tab + selection is shareable / reload-stable. */
function parseSelectionFromHash(hash: string): { kind: string; id: string } | null {
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  const kind = params.get('kind');
  const id = params.get('id');
  return kind && id ? { kind, id } : null;
}

function writeSelectionToHash(sel: { kind: string; id: string } | null): void {
  const next = sel
    ? `#/dev/registry?kind=${encodeURIComponent(sel.kind)}&id=${encodeURIComponent(sel.id)}`
    : '#/dev/registry';
  if (window.location.hash !== next) window.history.replaceState(null, '', next);
}

/** Bundle Inspector — read-only catalog browser at `#/dev/registry`.
 *  Mounted as a sibling to ToolkitBuilder. */
export function RegistryInspector() {
  const [runtime, setRuntime] = useState<RegistrySnapshot>({ tools: [], actions: [], properties: [] });
  const [textFilter, setTextFilter] = useState<string>('');
  const [selected, setSelected] = useState<TreeEntry | null>(null);
  // Pending deep-link from the URL — the matching entry may not exist yet
  // when the probe hasn't fired its first snapshot. Drained below once the
  // tree nodes are populated.
  const [pendingDeepLink, setPendingDeepLink] = useState<{ kind: string; id: string } | null>(
    () => parseSelectionFromHash(window.location.hash),
  );

  const onSnapshot = useCallback((snap: RegistrySnapshot) => setRuntime(snap), []);

  const bundles = useMemo(() => collectBundles(), []);
  // Lists every draw glyph, including ones no action names, so the build ships them only on request.
  useIconVariant('draw');
  const icons = useMemo(() => collectIcons(runtime.actions), [runtime.actions]);
  const shapeKinds = useMemo(() => collectShapeTrait(runtime.tools), [runtime.tools]);
  const propertiesEntries = useMemo(() => collectPropertiesTrait(runtime.properties), [runtime.properties]);
  const gestures = useMemo(() => collectGestures(), []);
  const phaseOutputs = useMemo(() => collectPhaseOutputs(), []);
  const opKinds = useMemo(() => collectOpKinds(), []);
  const slots = useMemo(() => collectSlots(), []);
  const meta = useMemo(() => collectMeta(), []);

  const nodes: readonly TreeCategoryNode[] = useMemo(() => {
    // A canvas's live tools, actions and routing are the devtools panel's Registry tab;
    // this page keeps draw's static catalog.
    const all: TreeCategoryNode[] = [
      { id: 'shape', label: 'Shape', group: { id: 'traits', label: 'Traits' }, entries: shapeKinds },
      { id: 'properties', label: 'Properties', group: { id: 'traits', label: 'Traits' }, entries: propertiesEntries },
      { id: 'bundles', label: 'Bundles', entries: bundles },
      { id: 'icons', label: 'Icons', entries: icons },
      { id: 'ops', label: 'Ops', entries: opKinds },
      { id: 'gestures', label: 'Gestures', entries: gestures },
      { id: 'phaseOutputs', label: 'Phase outputs', entries: phaseOutputs },
      { id: 'slots', label: 'Slots', entries: slots },
      { id: 'meta', label: 'Meta', entries: meta },
    ];
    // Bundles keep the preset table's order, each after the presets it includes, rather than alphabetizing.
    // `meta` is pinned to the bottom regardless of alphabetic order.
    return all
      .map((n) => (n.id === 'bundles'
        ? n
        : { ...n, entries: [...n.entries].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })) }))
      .sort((a, b) => {
        if (a.id === 'meta') return 1;
        if (b.id === 'meta') return -1;
        // Grouped categories sort by their group label (so the group lands at
        // its alphabetic position), then within the group by their own label.
        const aKey = a.group?.label ?? a.label;
        const bKey = b.group?.label ?? b.label;
        const top = aKey.localeCompare(bKey, undefined, { sensitivity: 'base' });
        if (top !== 0) return top;
        return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
      });
  }, [bundles, icons, shapeKinds, propertiesEntries, gestures, phaseOutputs, opKinds, slots, meta]);

  // Clear selection when the active filters narrow past the selected entry.
  const lower = textFilter.trim().toLowerCase();
  if (selected) {
    const inTree = nodes.some((n) => n.entries.some((e) => e.kind === selected.kind && e.id === selected.id));
    const matches = !lower
      || selected.id.toLowerCase().includes(lower)
      || selected.label.toLowerCase().includes(lower);
    if (!inTree || !matches) setSelected(null);
  }

  // Drain any pending deep-link once the matching entry exists in the tree.
  // The probe pushes its snapshot async on first render, so the URL-decoded
  // selection may name an entry that won't be in `nodes` for a frame or two.
  if (pendingDeepLink) {
    const hit = nodes
      .flatMap((node) => node.entries)
      .find((e) => e.kind === pendingDeepLink.kind && e.id === pendingDeepLink.id);
    if (hit) {
      setSelected(hit);
      setPendingDeepLink(null);
    }
  }

  // Mirror the selection into the URL hash so the inspector is deep-linkable.
  useEffect(() => {
    writeSelectionToHash(selected ? { kind: selected.kind, id: selected.id } : null);
  }, [selected]);

  // Respond to external hash changes (browser back/forward, manual URL edits).
  useEffect(() => {
    const onHash = () => {
      const parsed = parseSelectionFromHash(window.location.hash);
      if (!parsed) { setSelected(null); return; }
      // Resolve immediately if the entry already exists; otherwise queue.
      for (const node of nodes) {
        const hit = node.entries.find((e) => e.kind === parsed.kind && e.id === parsed.id);
        if (hit) { setSelected(hit); return; }
      }
      setPendingDeepLink(parsed);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [nodes]);

  const categories: readonly RegistryCategory[] = useMemo(() => nodes.map((n) => ({
    id: n.id,
    label: n.label,
    ...(n.group ? { group: n.group } : {}),
    entries: n.entries.map((e) => {
      const count = countForEntry(e, runtime.tools, runtime.actions);
      return {
        id: entryKey(e),
        label: e.label,
        match: [e.id],
        trailing: count === undefined
          ? undefined
          : <Badge className={s.leafBadge} shape="pill" size="sm" variant="solid">{count}</Badge>,
      };
    }),
  })), [nodes, runtime.tools, runtime.actions]);

  const selectedCategory = selected
    ? nodes.find((n) => n.entries.some((e) => e.kind === selected.kind && e.id === selected.id)) ?? null
    : null;
  const pick: RegistryBrowserPick | null = selected && selectedCategory
    ? { category: selectedCategory.id, id: entryKey(selected) }
    : null;

  return (
    <DevShell
      title="Bundle Inspector"
    >
      <div className={s.root}>
        <RegistryProbe onSnapshot={onSnapshot} />
        <RegistryBrowser
          categories={categories}
          selected={pick}
          onSelect={(p) => {
            const hit = nodes.find((n) => n.id === p.category)?.entries.find((e) => entryKey(e) === p.id);
            if (hit) setSelected(hit);
          }}
          filter={textFilter}
          onFilterChange={setTextFilter}
          filterIcon={<Icon name={icon('ui:search')} />}
          detail={selected
            ? <RegistryDetail
                entry={selected}
                tools={runtime.tools}
                actions={runtime.actions}
                category={selectedCategory}
                onNavigate={(t) => {
                  for (const node of nodes) {
                    const hit = node.entries.find((e) => e.kind === t.kind && e.id === t.id);
                    if (hit) { setSelected(hit); return; }
                  }
                }}
              />
            : <p className={s.empty}>Select an entry to see details.</p>}
        />
      </div>
    </DevShell>
  );
}
