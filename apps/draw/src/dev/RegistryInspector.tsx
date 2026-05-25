import { useCallback, useEffect, useMemo, useState } from 'react';
import s from './RegistryInspector.module.css';
import { RegistryTree } from './RegistryTree';
import { RegistryDetail } from './RegistryDetail';
import { RegistryProbe, type RegistrySnapshot } from './registryProbe';
import {
  collectBundles,
  collectGestures,
  collectGroups,
  collectHotkeyTriggers,
  countForEntry,
  collectIcons,
  collectMeta,
  collectModifierSets,
  collectRoutingTrait,
  collectOpFactories,
  collectOpKinds,
  collectPhases,
  collectPhaseOutputs,
  collectRoutes,
  collectRouteTargets,
  collectShapeTrait,
  collectSlots,
  type TreeCategoryNode,
  type TreeEntry,
} from './registryData';

const BUNDLE_OPTIONS = [
  { id: 'all', label: 'All bundles' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'standard', label: 'Standard' },
  { id: 'exhaustive', label: 'Exhaustive' },
] as const;

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
 *  Mounted as a sibling to ToolkitBuilder. See
 *  `docs/superpowers/specs/2026-05-16-bundle-inspector-design.md`. */
export function RegistryInspector() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Bundle Inspector';
    return () => { document.title = prev; };
  }, []);

  const [runtime, setRuntime] = useState<RegistrySnapshot>({ tools: [], actions: [], routing: [] });
  const [bundleFilter, setBundleFilter] = useState<string>('all');
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
  const icons = useMemo(() => collectIcons(), []);
  const opFactories = useMemo(() => collectOpFactories(), []);
  const shapeKinds = useMemo(() => collectShapeTrait(runtime.tools), [runtime.tools]);
  const routingEntries = useMemo(() => collectRoutingTrait(runtime.routing), [runtime.routing]);
  const phases = useMemo(() => collectPhases(), []);
  const gestures = useMemo(() => collectGestures(), []);
  const phaseOutputs = useMemo(() => collectPhaseOutputs(), []);
  const opKinds = useMemo(() => collectOpKinds(), []);
  const hotkeyTriggers = useMemo(() => collectHotkeyTriggers(runtime.actions), [runtime.actions]);
  const slots = useMemo(() => collectSlots(), []);
  const routes = useMemo(() => collectRoutes(runtime.tools), [runtime.tools]);
  const routeTargets = useMemo(() => collectRouteTargets(runtime.tools), [runtime.tools]);
  const modifierSets = useMemo(() => collectModifierSets(runtime.tools), [runtime.tools]);
  const groups = useMemo(() => collectGroups(runtime.tools, runtime.actions), [runtime.tools, runtime.actions]);
  const meta = useMemo(() => collectMeta(), []);

  const activeBundle = bundles.find((b) => b.id === bundleFilter);

  const nodes: readonly TreeCategoryNode[] = useMemo(() => {
    const filterByBundle = <T extends { id: string }>(
      entries: readonly T[],
      allowed: readonly string[] | null,
    ): readonly T[] => {
      if (!allowed) return entries;
      const allow = new Set(allowed);
      return entries.filter((e) => allow.has(e.id));
    };

    // Bundles describe tool presets only; actions stay unfiltered.
    const all: TreeCategoryNode[] = [
      {
        id: 'tools',
        label: 'Tools',
        entries: filterByBundle(runtime.tools, activeBundle ? activeBundle.tools : null),
      },
      { id: 'actions', label: 'Actions', entries: runtime.actions },
      { id: 'shape', label: 'Shape', group: { id: 'traits', label: 'Traits' }, entries: shapeKinds },
      { id: 'routing', label: 'Routing', group: { id: 'traits', label: 'Traits' }, entries: routingEntries },
      { id: 'bundles', label: 'Bundles', entries: bundles },
      { id: 'icons', label: 'Icons', entries: icons },
      { id: 'ops', label: 'Ops', entries: opKinds },
      { id: 'phases', label: 'Phases', entries: phases },
      { id: 'gestures', label: 'Gestures', entries: gestures },
      { id: 'phaseOutputs', label: 'Phase outputs', entries: phaseOutputs },
      { id: 'hotkeyTriggers', label: 'Hotkey triggers', entries: hotkeyTriggers },
      { id: 'slots', label: 'Slots', entries: slots },
      { id: 'routes', label: 'Routes', entries: routes },
      { id: 'routeTargets', label: 'Route targets', entries: routeTargets },
      { id: 'modifierSets', label: 'Modifier sets', entries: modifierSets },
      { id: 'groups', label: 'Action groups', entries: groups },
      { id: 'meta', label: 'Meta', entries: meta },
    ];
    // Bundles convey a deliberate progression (minimal → standard →
    // exhaustive); preserve their declared order rather than alphabetizing.
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
  }, [runtime, activeBundle, bundles, icons, opFactories, shapeKinds, routingEntries, phases, gestures, phaseOutputs, opKinds, hotkeyTriggers, slots, routes, routeTargets, modifierSets, groups, meta]);

  // Clear selection when the active filters narrow past the selected entry.
  const lower = textFilter.trim().toLowerCase();
  useEffect(() => {
    if (!selected) return;
    const category = nodes.find((n) => n.entries.some((e) => e.kind === selected.kind && e.id === selected.id));
    if (!category) { setSelected(null); return; }
    if (lower) {
      const matches = selected.id.toLowerCase().includes(lower)
        || selected.label.toLowerCase().includes(lower);
      if (!matches) setSelected(null);
    }
  }, [nodes, lower, selected]);

  // Drain any pending deep-link once the matching entry exists in the tree.
  // The probe pushes its snapshot async on first render, so the URL-decoded
  // selection may name an entry that won't be in `nodes` for a frame or two.
  useEffect(() => {
    if (!pendingDeepLink) return;
    for (const node of nodes) {
      const hit = node.entries.find((e) => e.kind === pendingDeepLink.kind && e.id === pendingDeepLink.id);
      if (hit) {
        setSelected(hit);
        setPendingDeepLink(null);
        return;
      }
    }
  }, [pendingDeepLink, nodes]);

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

  return (
    <div className={s.root}>
      <RegistryProbe onSnapshot={onSnapshot} />
      <header className={s.header}>
        <h1 className={s.title}>Bundle Inspector</h1>
        <label className={s.bundlePicker}>
          bundle
          <select
            aria-label="bundle filter"
            value={bundleFilter}
            onChange={(e) => setBundleFilter(e.target.value)}
          >
            {BUNDLE_OPTIONS.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </label>
      </header>
      <div className={s.layout}>
        <aside className={s.tree}>
          <RegistryTree
            nodes={nodes}
            selected={selected}
            onSelect={setSelected}
            filter={textFilter}
            onFilterChange={setTextFilter}
            getCount={(e) => countForEntry(e, runtime.tools, runtime.actions)}
          />
        </aside>
        <section className={s.detail}>
          {selected
            ? <RegistryDetail
                entry={selected}
                tools={runtime.tools}
                actions={runtime.actions}
                category={nodes.find((n) => n.entries.some((e) => e.kind === selected.kind && e.id === selected.id)) ?? null}
                onNavigate={(t) => {
                  for (const node of nodes) {
                    const hit = node.entries.find((e) => e.kind === t.kind && e.id === t.id);
                    if (hit) { setSelected(hit); return; }
                  }
                }}
              />
            : <p className={s.empty}>Select an entry to see details.</p>}
        </section>
      </div>
    </div>
  );
}
