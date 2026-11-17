/**
 * Toolkit Builder — assemble a canvas from one of core's presets and any of its
 * tool presets, with or without `@weasel-js/path-tools` and `@weasel-js/text-tools`, and inspect the
 * resulting live registry, route table, conflicts, and dispatch trace. Mounted
 * under `#/dev/toolkits` (sibling to `RegistryInspector` at `#/dev/registry`).
 */
import { solid } from '@weasel-js/paint';
import { asNodeId, type FeaturePreset, type Fill, SceneCanvas, useScene } from '@weasel-js/core';
import { FEATURE_NAMES, type FeatureName, namedFeatures } from '@weasel-js/editing';
import { pathTools, usePathToolsTools } from '@weasel-js/path-tools';
import { textToolsPreset } from '@weasel-js/text-tools';
import { Select } from '@weasel-js/ui/components/Select';
import { CheckboxGroup } from '@weasel-js/ui/components/CheckboxGroup';
import { useRegisteredActions } from '@weasel-js/ui/components/Prefs';
import { type ReactElement, useEffect, useState } from 'react';
import { useWindowEvent } from '@weasel-js/react';
import { DevShell } from './DevShell';
import { ActionsWidget } from './toolkit/ActionsWidget';
import { ConflictsWidget } from './toolkit/ConflictsWidget';
import { DispatchTraceWidget } from './toolkit/DispatchTraceWidget';
import { ResolutionWidget } from './toolkit/ResolutionWidget';
import { RoutesWidget } from './toolkit/RoutesWidget';
import { ToolsWidget } from './toolkit/ToolsWidget';
import { useToolReflection } from './toolkit/useToolReflection';
import s from './ToolkitBuilder.module.css';

const TOOL_PRESETS = FEATURE_NAMES.filter((f) => f.startsWith('tools:'));
const BASES = FEATURE_NAMES.filter((f) => !f.startsWith('tools:'));
const isFeature = (f: string): f is FeatureName => (FEATURE_NAMES as readonly string[]).includes(f);
/** Every switch in the header: each tool preset, then path-tools' and text-tools' presets. */
const SWITCHES = [...TOOL_PRESETS, 'path-tools', 'text-tools'] as const;
type SwitchName = (typeof SWITCHES)[number];

const switchesOn = ({ tools, paths, text }: Setup): SwitchName[] =>
  SWITCHES.filter((id) => (id === 'path-tools' ? paths : id === 'text-tools' ? text : tools.includes(id)));

interface Setup { base: FeatureName; tools: readonly FeatureName[]; paths: boolean; text: boolean }

function parseSetup(hash: string): Setup {
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  const base = params.get('base') ?? '';
  const tools = params.get('tools');
  return {
    base: isFeature(base) ? base : 'draw',
    tools: tools === null ? ['tools:shape'] : tools.split(',').filter(isFeature),
    paths: params.get('paths') !== '0',
    text: params.get('text') !== '0',
  };
}

const setupKey = ({ base, tools, paths, text }: Setup): string =>
  `base=${base}&tools=${tools.join(',')}${paths ? '' : '&paths=0'}${text ? '' : '&text=0'}`;

function writeSetup(setup: Setup): void {
  const next = `#/dev/toolkits?${setupKey(setup)}`;
  if (window.location.hash !== next) window.history.replaceState(null, '', next);
}

interface ShapeData { fill: Fill }
interface ShapePose { x: number; y: number; width: number; height: number }

const INITIAL_NODES = [
  { kind: 'mark' as const, id: asNodeId('r1'), layer: 'default' as const, data: { fill: { paint: solid('#7fb069') } }, pose: { x: 80,  y: 60,  width: 120, height: 80 } },
  { kind: 'mark' as const, id: asNodeId('r2'), layer: 'default' as const, data: { fill: { paint: solid('#d97757') } }, pose: { x: 260, y: 100, width: 100, height: 100 } },
  { kind: 'mark' as const, id: asNodeId('r3'), layer: 'default' as const, data: { fill: { paint: solid('#5a8bd0') } }, pose: { x: 140, y: 220, width: 160, height: 60 } },
];

function ToolkitForSetup({ base, tools, paths, text }: Setup): ReactElement {
  const scene = useScene<ShapeData, 'default', ShapePose>({
    systemLayers: [{ id: 'default' }],
    initial: INITIAL_NODES,
  });
  const reflection = useToolReflection();
  const actions = useRegisteredActions();
  const pathToolsTools = usePathToolsTools();
  const features: FeaturePreset[] = [
    ...namedFeatures(base, ...tools), ...(paths ? [pathTools] : []), ...(text ? [textToolsPreset] : []),
  ];

  return (
    <div className={s.layout}>
      {/* Left column: canvas. */}
      <section className={s.canvas}>
        <SceneCanvas features={features}
          aria-label="Toolkit canvas"
          scene={scene}
          width={520}
          height={360}
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
          activeToolId={reflection.activeToolId}
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
  const key = setupKey(setup);

  // Sync hash on a change + react to back/forward.
  useEffect(() => { writeSetup(setup); }, [setup]);
  useWindowEvent('hashchange', () => {
    const next = parseSetup(window.location.hash);
    setSetup((prev) => (setupKey(prev) === setupKey(next) ? prev : next));
  });

  return (
    <DevShell
      title="Toolkit Builder"
      header={
        <>
          <Select<FeatureName>
            label="preset"
            orientation="row"
            width="fit"
            options={BASES.map((id) => ({ value: id, label: id }))}
            selectedKey={setup.base}
            onSelectionChange={(next) => setSetup((prev) => ({ ...prev, base: next }))}
          />
          <CheckboxGroup<SwitchName>
            aria-label="Presets"
            control="switch"
            orientation="horizontal"
            sweep
            items={SWITCHES.map((id) => ({ value: id, label: id }))}
            value={switchesOn(setup)}
            onChange={(on) => setSetup((prev) => ({
              ...prev,
              tools: TOOL_PRESETS.filter((t) => on.includes(t)),
              paths: on.includes('path-tools'),
              text: on.includes('text-tools'),
            }))}
          />
        </>
      }
    >
      <div className={s.root}>
        <p className={s.subtitle}>
          Mount a SceneCanvas with the chosen preset and tool presets, and with
          path-tools' and text-tools' presets and tools when each is on, then inspect the live tool
          set, action registry, route table, and dispatch trace it produces.
        </p>
        {/* Key by the setup so SceneCanvas rebuilds cleanly when it changes. */}
        <ToolkitForSetup key={key} {...setup} />
      </div>
    </DevShell>
  );
}

export default ToolkitBuilder;
