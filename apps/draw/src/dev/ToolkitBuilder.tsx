/**
 * Toolkit Builder — assemble a canvas from a bundle preset and inspect the
 * resulting live registry, route table, conflicts, and dispatch trace. Mounted
 * under `#/dev/toolkits` (sibling to `RegistryInspector` at `#/dev/registry`).
 */
import { asNodeId, type Fill, SceneCanvas, solid, useScene } from '@weasel-js/core';
import { Select } from '@weasel-js/ui';
import { type ReactElement, useEffect, useState } from 'react';
import { DevShell } from './DevShell';
import { BUNDLE_DEFAULT_TOOLS } from './registryData';
import { ActionsWidget } from './toolkit/ActionsWidget';
import { ConflictsWidget } from './toolkit/ConflictsWidget';
import { DispatchTraceWidget } from './toolkit/DispatchTraceWidget';
import { ResolutionWidget } from './toolkit/ResolutionWidget';
import { RoutesWidget } from './toolkit/RoutesWidget';
import { ToolsWidget } from './toolkit/ToolsWidget';
import { useLiveActions, useToolReflection } from './toolkit/useToolReflection';
import s from './ToolkitBuilder.module.css';

type ToolBundle = keyof typeof BUNDLE_DEFAULT_TOOLS;
const BUNDLE_IDS: readonly ToolBundle[] = ['minimal', 'standard', 'exhaustive'];
const DEFAULT_BUNDLE: ToolBundle = 'standard';

function parseBundle(hash: string): ToolBundle {
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  const b = params.get('bundle');
  if (b && (BUNDLE_IDS as readonly string[]).includes(b)) return b as ToolBundle;
  return DEFAULT_BUNDLE;
}

function writeBundle(b: ToolBundle): void {
  const next = `#/dev/toolkits?bundle=${b}`;
  if (window.location.hash !== next) window.history.replaceState(null, '', next);
}

interface ShapeData { fill: Fill }
interface ShapePose { x: number; y: number; width: number; height: number }

const INITIAL_NODES = [
  { kind: 'leaf' as const, id: asNodeId('r1'), layer: 'default' as const, data: { fill: { paint: solid('#7fb069') } }, pose: { x: 80,  y: 60,  width: 120, height: 80 } },
  { kind: 'leaf' as const, id: asNodeId('r2'), layer: 'default' as const, data: { fill: { paint: solid('#d97757') } }, pose: { x: 260, y: 100, width: 100, height: 100 } },
  { kind: 'leaf' as const, id: asNodeId('r3'), layer: 'default' as const, data: { fill: { paint: solid('#5a8bd0') } }, pose: { x: 140, y: 220, width: 160, height: 60 } },
];

function ToolkitForBundle({ bundle }: { bundle: ToolBundle }): ReactElement {
  const scene = useScene<ShapeData, 'default', ShapePose>({
    systemLayers: [{ id: 'default' }],
    initial: INITIAL_NODES,
  });
  const reflection = useToolReflection();
  const actions = useLiveActions();

  return (
    <div className={s.layout}>
      {/* Left column: canvas. */}
      <section className={s.canvas}>
        <SceneCanvas features={['draw']}
          scene={scene}
          width={520}
          height={360}
          defaultTools={BUNDLE_DEFAULT_TOOLS[bundle]}
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
  const [bundle, setBundle] = useState<ToolBundle>(() => parseBundle(window.location.hash));

  // Sync hash on bundle change + react to back/forward.
  useEffect(() => { writeBundle(bundle); }, [bundle]);
  useEffect(() => {
    const onHash = () => {
      const next = parseBundle(window.location.hash);
      setBundle((prev) => (prev === next ? prev : next));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <DevShell
      title="Toolkit Builder"
      header={
        <Select<ToolBundle>
          label="bundle"
          orientation="row"
          width="fit"
          options={BUNDLE_IDS.map((id) => ({ value: id, label: id }))}
          selectedKey={bundle}
          onSelectionChange={setBundle}
        />
      }
    >
      <div className={s.root}>
        <p className={s.subtitle}>
          Mount a SceneCanvas with the chosen bundle, then inspect the live tool
          set, action registry, route table, and dispatch trace it produces.
        </p>
        {/* Key by bundle so SceneCanvas rebuilds cleanly when it changes. */}
        <ToolkitForBundle key={bundle} bundle={bundle} />
      </div>
    </DevShell>
  );
}

export default ToolkitBuilder;
