/**
 * Toolkit Builder — assemble a canvas from a bundle preset, with or without
 * `@weasel-js/path-tools`, and inspect the resulting live registry, route
 * table, conflicts, and dispatch trace. Mounted
 * under `#/dev/toolkits` (sibling to `RegistryInspector` at `#/dev/registry`).
 */
import { asNodeId, type Fill, SceneCanvas, solid, useScene } from '@weasel-js/core';
import { pathTools } from '@weasel-js/path-tools';
import { Select } from '@weasel-js/ui/components/Select';
import { Switch } from '@weasel-js/ui/components/Switch';
import { type ReactElement, useEffect, useState } from 'react';
import { DevShell } from './DevShell';
import { BUNDLE_DEFAULT_TOOLS } from './registryData';
import { ActionsWidget } from './toolkit/ActionsWidget';
import { ConflictsWidget } from './toolkit/ConflictsWidget';
import { DispatchTraceWidget } from './toolkit/DispatchTraceWidget';
import { ResolutionWidget } from './toolkit/ResolutionWidget';
import { RoutesWidget } from './toolkit/RoutesWidget';
import { ToolsWidget } from './toolkit/ToolsWidget';
import { usePathToolsTools } from '../usePathToolsTools';
import { useLiveActions, useToolReflection } from './toolkit/useToolReflection';
import s from './ToolkitBuilder.module.css';

type ToolBundle = keyof typeof BUNDLE_DEFAULT_TOOLS;
const BUNDLE_IDS: readonly ToolBundle[] = ['minimal', 'standard', 'exhaustive'];
const DEFAULT_BUNDLE: ToolBundle = 'standard';

interface Setup { bundle: ToolBundle; paths: boolean }

function parseSetup(hash: string): Setup {
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  const b = params.get('bundle');
  return {
    bundle: b && (BUNDLE_IDS as readonly string[]).includes(b) ? b as ToolBundle : DEFAULT_BUNDLE,
    paths: params.get('paths') !== '0',
  };
}

function writeSetup({ bundle, paths }: Setup): void {
  const next = `#/dev/toolkits?bundle=${bundle}${paths ? '' : '&paths=0'}`;
  if (window.location.hash !== next) window.history.replaceState(null, '', next);
}

interface ShapeData { fill: Fill }
interface ShapePose { x: number; y: number; width: number; height: number }

const INITIAL_NODES = [
  { kind: 'leaf' as const, id: asNodeId('r1'), layer: 'default' as const, data: { fill: { paint: solid('#7fb069') } }, pose: { x: 80,  y: 60,  width: 120, height: 80 } },
  { kind: 'leaf' as const, id: asNodeId('r2'), layer: 'default' as const, data: { fill: { paint: solid('#d97757') } }, pose: { x: 260, y: 100, width: 100, height: 100 } },
  { kind: 'leaf' as const, id: asNodeId('r3'), layer: 'default' as const, data: { fill: { paint: solid('#5a8bd0') } }, pose: { x: 140, y: 220, width: 160, height: 60 } },
];

function ToolkitForSetup({ bundle, paths }: Setup): ReactElement {
  const scene = useScene<ShapeData, 'default', ShapePose>({
    systemLayers: [{ id: 'default' }],
    initial: INITIAL_NODES,
  });
  const reflection = useToolReflection();
  const actions = useLiveActions();
  const pathToolsTools = usePathToolsTools();

  return (
    <div className={s.layout}>
      {/* Left column: canvas. */}
      <section className={s.canvas}>
        <SceneCanvas features={paths ? ['draw', pathTools] : ['draw']}
          scene={scene}
          width={520}
          height={360}
          defaultTools={BUNDLE_DEFAULT_TOOLS[bundle]}
          {...(paths ? { tools: pathToolsTools } : {})}
          onToolsCreated={reflection.onToolsCreated}
          className={s.scene}
        />
        <p className={s.hint}>
          Interact with the canvas to populate the dispatch trace on the right.
          Slots: <code>{reflection.slots.registry.length}</code> registry,{' '}
          <code>{reflection.slots.ambient.length}</code> ambient.
        </p>
      </section>

      {/* Middle column: tool table and binding resolution. */}
      <section className={s.catalog}>
        <ToolsWidget defs={reflection.defs} slots={reflection.slots} actions={actions} />
        <ResolutionWidget
          tools={reflection.tools}
          actions={actions}
          activeToolId={reflection.slots.registry[0] ?? ''}
        />
      </section>

      {/* Under the canvas and middle column: the two wide tables. */}
      <section className={s.tables}>
        <ActionsWidget actions={actions} />
        <RoutesWidget routes={reflection.routes} slots={reflection.slots} />
      </section>

      {/* Right column: conflicts + live dispatch trace. */}
      <aside className={s.reflect}>
        <ConflictsWidget conflicts={reflection.conflicts} />
        <DispatchTraceWidget />
      </aside>
    </div>
  );
}

export function ToolkitBuilder(): ReactElement {
  const [setup, setSetup] = useState<Setup>(() => parseSetup(window.location.hash));
  const { bundle, paths } = setup;

  // Sync hash on a change + react to back/forward.
  useEffect(() => { writeSetup({ bundle, paths }); }, [bundle, paths]);
  useEffect(() => {
    const onHash = () => {
      const next = parseSetup(window.location.hash);
      setSetup((prev) => (prev.bundle === next.bundle && prev.paths === next.paths ? prev : next));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <DevShell
      title="Toolkit Builder"
      header={
        <>
          <Select<ToolBundle>
            label="bundle"
            orientation="row"
            width="fit"
            options={BUNDLE_IDS.map((id) => ({ value: id, label: id }))}
            selectedKey={bundle}
            onSelectionChange={(next) => setSetup((prev) => ({ ...prev, bundle: next }))}
          />
          <Switch isSelected={paths} onChange={(next) => setSetup((prev) => ({ ...prev, paths: next }))}>
            path-tools
          </Switch>
        </>
      }
    >
      <div className={s.root}>
        <p className={s.subtitle}>
          Mount a SceneCanvas with the chosen bundle, and with path-tools' presets
          and tools when it is on, then inspect the live tool set, action
          registry, route table, and dispatch trace it produces.
        </p>
        {/* Key by the setup so SceneCanvas rebuilds cleanly when it changes. */}
        <ToolkitForSetup key={`${bundle}:${paths}`} bundle={bundle} paths={paths} />
      </div>
    </DevShell>
  );
}

export default ToolkitBuilder;
