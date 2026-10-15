import {
  asNodeId,
  boundsOfPath,
  createScene,
  createSymmetryStore,
  pathFromD,
  type PathEditHost,
  type RectPose,
  solid,
  symmetryContribution,
} from '@weasel-js/core';
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
import { PenIcon, PencilIcon, RectIcon, SelectIcon } from '@weasel-js/ui';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';

/** Where the axis starts: the kite below is its own mirror image across x = 300. */
export const AXIS_START = { x: 300, y: 200 };
export const KITE_ID = 'kite';

const config = f.schema({
  symmetry: f.boolean(true).label('Symmetry'),
  axis: f.enum('vertical', [
    { value: 'vertical', label: 'Vertical' },
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'both', label: 'Both' },
  ]).label('Axis'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

function pathNode(id: string, d: string, color: string) {
  const path = pathFromD(d);
  const { x, y, width, height } = boundsOfPath(path);
  return {
    id: asNodeId(id),
    kind: 'leaf' as const,
    layer: 'default' as const,
    pose: { x, y, width, height },
    data: { path, fill: { paint: solid(color) } },
  };
}

/** The kite, selected and open in path edit. */
function createLabScene() {
  const scene = createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [pathNode(KITE_ID, 'M300 60 C340 90 380 130 380 160 L300 330 L220 160 C220 130 260 90 300 60 Z', '#7fb069')],
  });
  scene.setSelection([asNodeId(KITE_ID)]);
  return scene;
}

/** Which path is open in path edit: the kite, to start with. */
function usePathEditHost(): { host: PathEditHost; redraw: { subscribe(l: () => void): () => void } } {
  const [store] = useState(() => {
    let id: string | null = KITE_ID;
    const listeners = new Set<() => void>();
    return {
      host: {
        editingId: () => id,
        setEditingId: (next: string | null) => {
          id = next;
          for (const l of [...listeners]) l();
        },
      },
      redraw: {
        subscribe(l: () => void) {
          listeners.add(l);
          return () => { listeners.delete(l); };
        },
      },
    };
  });
  return store;
}

function SymmetryTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const [store] = useState(() => createSymmetryStore());
  const entry = useMemo(() => [symmetryContribution(store)], [store]);
  const pathEdit = usePathEditHost();
  const redrawOn = useMemo(() => [pathEdit.redraw], [pathEdit]);
  const { symmetry, axis } = ctx.config;

  // A dragged axis stays where it was left across a change of axis.
  const center = useRef(AXIS_START);
  useLayoutEffect(() => store.subscribe(() => {
    center.current = store.get()?.center ?? center.current;
  }), [store]);
  useLayoutEffect(() => {
    store.set(symmetry ? { axis, center: center.current } : null);
  }, [store, symmetry, axis]);

  return (
    <TrialSceneCanvas
      features={['draw']}
      defaultTools={['rect', 'pen', 'pencil']}
      scene={scene}
      trial={ctx.trial}
      ambient={entry}
      pathEdit={pathEdit.host}
      redrawOn={redrawOn}
    />
  );
}

const symmetryInstrument = defineInstrument<State, Config>({
  name: 'Symmetry',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: SelectIcon, shortcut: 'V' },
      { id: 'rect', label: 'Rectangle', icon: RectIcon, shortcut: 'R' },
      { id: 'pen', label: 'Pen', icon: PenIcon, shortcut: 'P' },
      { id: 'pencil', label: 'Pencil', icon: PencilIcon, shortcut: 'N' },
    ],
  },
  render: (ctx) => <SymmetryTrial ctx={ctx} />,
});

export function SymmetryLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Live symmetry" instruments={[symmetryInstrument]} defaultInstrument="Symmetry" />
    </div>
  );
}
