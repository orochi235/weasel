import { type ActionTunings, asNodeId, boundsOfPath, createScene, type PathConstraint, type PathConstraintKind, type PolygonPath, polygonFromPoints, type RectPose, solid, worldEditToStorage } from '@weasel-js/core';
import { constraintConflictsOf, constraintsOf, constraintsPreset } from '@weasel-js/path-tools';
import {
  type ConfigOf,
  defineInstrument,
  f,
  Lab,
  type RenderContext,
  type SceneTrialState,
  TrialSceneCanvas,
  useTrialScene,
} from '@weasel-js/labkit';
import { useMemo, useState, useSyncExternalStore } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import s from './PathConstraintsLabDemo.module.css';
import { icon } from '../icons.gen';

const FEATURES = ['draw', constraintsPreset] as const;

const KIND_LABELS: Record<PathConstraintKind, string> = {
  horizontal: 'Horizontal',
  vertical: 'Vertical',
  parallel: 'Parallel',
  perpendicular: 'Perpendicular',
  equalLength: 'Equal length',
  length: 'Length',
  coincident: 'Coincident',
  fixed: 'Fixed',
  tangent: 'Tangent',
  onPath: 'On path',
};

const config = f.schema({
  kind: f.enum<PathConstraintKind>('perpendicular', Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })))
    .label('C adds'),
  length: f.number(160).range(20, 400).step(10).suffix('px').label('Length').showIf({ path: 'kind', is: 'length' }),
});
type Config = ConfigOf<typeof config>;
type Data = { path: PolygonPath; fill: unknown; stroke: unknown; constraints: PathConstraint[] };
type State = SceneTrialState<Data, 'default', RectPose>;

const ID = asNodeId('shape');

/** Corners 0 → 1 → 2 → 3: the bottom edge is 0–1, the right 1–2. */
const CORNERS = [{ x: 140, y: 300 }, { x: 340, y: 300 }, { x: 420, y: 140 }, { x: 220, y: 140 }];

const SEED: PathConstraint[] = [
  { kind: 'parallel', segments: [[0, 1], [3, 2]] },
  { kind: 'parallel', segments: [[1, 2], [0, 3]] },
  { kind: 'horizontal', segment: [0, 1] },
  { kind: 'fixed', anchor: 0 },
];

function createLabScene() {
  const world = polygonFromPoints(CORNERS) as PolygonPath;
  const { pose, path } = worldEditToStorage<RectPose>(boundsOfPath(world), world);
  const scene = createScene<Data, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [{
      id: ID,
      kind: 'leaf',
      layer: 'default',
      pose,
      data: {
        path,
        fill: { paint: solid('#e8dcc4') },
        stroke: { paint: solid('#5a4632'), width: 2 },
        constraints: SEED,
      },
    }],
  });
  scene.setSelection([ID]);
  return scene;
}

/** A path-edit host that opens on the seeded shape. */
function createEditHost() {
  let id: string | null = ID;
  const listeners = new Set<() => void>();
  return {
    editingId: () => id,
    setEditingId(next: string | null) {
      id = next;
      for (const l of listeners) l();
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

function describeStatus(scene: ReturnType<typeof createLabScene>): string {
  const node = scene.get(ID);
  if (!node) return 'The shape is gone.';
  const constraints = constraintsOf(node.data);
  const broken = constraintConflictsOf(node);
  const count = `${constraints.length} constraint${constraints.length === 1 ? '' : 's'}`;
  if (broken.length === 0) return `${count}, all holding.`;
  return `${count}. Conflicting, left unsolved: ${broken.map((i) => KIND_LABELS[constraints[i].kind]).join(', ')}.`;
}

function ConstraintsTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const [host] = useState(createEditHost);
  const { kind, length } = ctx.config;
  const tune = useMemo<ActionTunings>(() => ({
    constrainAnchors: {
      params: kind === 'length' ? { kind, length } : { kind },
      bindings: [{ kind: 'key', key: 'c' }],
    },
    unconstrainAnchors: { bindings: [{ kind: 'key', key: 'c', mods: { shift: true } }] },
  }), [kind, length]);
  const redrawOn = useMemo(() => [host], [host]);
  useSyncExternalStore(scene.subscribe, scene.getVersion);

  return (
    <div className={s.trial}>
      <TrialSceneCanvas
        features={FEATURES}
        scene={scene}
        trial={ctx.trial}
        pathEdit={host}
        redrawOn={redrawOn}
        tune={tune}
      />
      <p className={s.status} role="status">{describeStatus(scene)}</p>
    </div>
  );
}

const constraintsInstrument = defineInstrument<State, Config>({
  name: 'Constraints',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' }] },
  render: (ctx) => <ConstraintsTrial ctx={ctx} />,
});

export function PathConstraintsLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Path constraints" instruments={[constraintsInstrument]} defaultInstrument="Constraints" />
    </div>
  );
}
