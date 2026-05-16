import { useCallback, useEffect, useMemo, useState } from 'react';
import s from './RegistryInspector.module.css';
import { RegistryTree } from './RegistryTree';
import { RegistryDetail } from './RegistryDetail';
import { RegistryProbe, type RegistrySnapshot } from './registryProbe';
import {
  collectBundles,
  collectIcons,
  collectOpFactories,
  collectPublicExports,
  collectShapeKinds,
  type TreeCategoryNode,
  type TreeEntry,
} from './registryData';

const BUNDLE_OPTIONS = [
  { id: 'all', label: 'All bundles' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'standard', label: 'Standard' },
  { id: 'exhaustive', label: 'Exhaustive' },
] as const;

/** Bundle Inspector — read-only catalog browser at `#/dev/registry`.
 *  Mounted as a sibling to ToolkitBuilder. See
 *  `docs/superpowers/specs/2026-05-16-bundle-inspector-design.md`. */
export function RegistryInspector() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Bundle Inspector';
    return () => { document.title = prev; };
  }, []);

  const [runtime, setRuntime] = useState<RegistrySnapshot>({ tools: [], actions: [] });
  const [bundleFilter, setBundleFilter] = useState<string>('all');
  const [selected, setSelected] = useState<TreeEntry | null>(null);

  const onSnapshot = useCallback((snap: RegistrySnapshot) => setRuntime(snap), []);

  const bundles = useMemo(() => collectBundles(), []);
  const icons = useMemo(() => collectIcons(), []);
  const opFactories = useMemo(() => collectOpFactories(), []);
  const publicExports = useMemo(() => collectPublicExports(), []);
  const shapeKinds = useMemo(() => collectShapeKinds(), []);

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

    return [
      {
        id: 'tools',
        label: 'Tools',
        entries: filterByBundle(runtime.tools, activeBundle ? activeBundle.tools : null),
      },
      {
        id: 'actions',
        label: 'Actions',
        entries: filterByBundle(runtime.actions, activeBundle ? activeBundle.actions : null),
      },
      { id: 'shapeKinds', label: 'Shape kinds', entries: shapeKinds },
      { id: 'bundles', label: 'Bundles', entries: bundles },
      { id: 'icons', label: 'Icons', entries: icons },
      { id: 'opFactories', label: 'Op factories', entries: opFactories },
      { id: 'publicExports', label: 'Public exports', entries: publicExports },
    ];
  }, [runtime, activeBundle, bundles, icons, opFactories, publicExports, shapeKinds]);

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
          <RegistryTree nodes={nodes} selected={selected} onSelect={setSelected} />
        </aside>
        <section className={s.detail}>
          {selected
            ? <RegistryDetail entry={selected} onNavigate={(t) => {
                const list = t.kind === 'tool' ? runtime.tools : runtime.actions;
                const next = list.find((e) => e.id === t.id);
                if (next) setSelected(next);
              }} />
            : <p className={s.empty}>Select an entry to see details.</p>}
        </section>
      </div>
    </div>
  );
}
