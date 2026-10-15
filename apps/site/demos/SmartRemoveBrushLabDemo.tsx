import {
  type ActionsProp, asNodeId, boundsOfPath, createScene, type PathEditHost, pathFromD, type RectPose, solid,
  useLatest,
} from '@weasel-js/core';
import {
  type ConfigOf, defineInstrument, f, Lab, type RenderContext, type SceneTrialState,
  TrialSceneCanvas, useTrialScene,
} from '@weasel-js/labkit';
import { createModeRegistry, DEFAULT_MODES } from '@weasel-js/modes';
import { PenIcon, SelectIcon } from '@weasel-js/ui';
import { useMemo, useState } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';

const config = f.schema({
  radiusPx: f.number(16).range(4, 60).step(1).suffix('px').label('Brush radius'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

type Point = { x: number; y: number };

/** A smooth closed curve through `pts`: each segment's handles follow the
 *  neighbors on either side, so every anchor carries curvature to refit. */
function smoothClosedD(pts: readonly Point[]): string {
  const at = (i: number) => pts[(i + pts.length) % pts.length];
  const r = (n: number) => n.toFixed(2);
  let d = `M${r(pts[0].x)} ${r(pts[0].y)}`;
  for (let i = 0; i < pts.length; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${r(c1.x)} ${r(c1.y)} ${r(c2.x)} ${r(c2.y)} ${r(p2.x)} ${r(p2.y)}`;
  }
  return `${d} Z`;
}

/** A six-petaled flower drawn through `count` anchors. */
function flowerPoints(cx: number, cy: number, count: number): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i / count) * Math.PI * 2;
    const radius = 130 + 30 * Math.cos(6 * t);
    return { x: cx + radius * Math.cos(t), y: cy + radius * Math.sin(t) };
  });
}

export const SEEDED_PATH_ID = 'flower';

const pathNode = (id: string, d: string, color: string) => {
  const path = pathFromD(d);
  return {
    id: asNodeId(id),
    kind: 'leaf' as const,
    layer: 'default' as const,
    pose: boundsOfPath(path),
    data: { path, fill: { paint: solid(color) }, stroke: { paint: solid('#1a130d'), width: 1.5 } },
  };
};

const createLabScene = () =>
  createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [pathNode(SEEDED_PATH_ID, smoothClosedD(flowerPoints(320, 240, 36)), '#e0a458')],
  });

/** Path edit as a mode the trial holds: the open path is the mode's target. */
function usePathEditMode(seeded: string) {
  const [modes] = useState(() => createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' }));
  const [target, setTarget] = useState<string | null>(seeded);
  const pathEdit = useMemo<PathEditHost>(() => ({
    editingId: () => (modes.current().id === 'path-edit' ? target : null),
    setEditingId: (id) => {
      setTarget(id);
      modes.setMode(id ? 'path-edit' : 'normal');
    },
  }), [modes, target]);
  return { modes, pathEdit };
}

function BrushTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { modes, pathEdit } = usePathEditMode(SEEDED_PATH_ID);
  const radius = useLatest(ctx.config.radiusPx);
  // Thunked, so a radius change reaches a stroke already under way.
  const actions = useMemo<ActionsProp>(() => ({
    brushDeleteAnchors: {
      defaultBinding: [{
        spec: { kind: 'drag', mods: { alt: true } },
        opts: { params: () => ({ radiusPx: radius.current }) },
      }],
    },
  }), [radius]);
  const selectionOptions = useMemo(() => ({ initial: [asNodeId(SEEDED_PATH_ID)] }), []);

  return (
    <TrialSceneCanvas
      features={['draw']}
      defaultTools={['pen']}
      scene={scene}
      trial={ctx.trial}
      modes={modes}
      pathEdit={pathEdit}
      actions={actions}
      selectionOptions={selectionOptions}
    />
  );
}

const brushInstrument = defineInstrument<State, Config>({
  name: 'Brush',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: SelectIcon, shortcut: 'V' },
      { id: 'pen', label: 'Pen', icon: PenIcon, shortcut: 'P' },
    ],
  },
  chrome: [{
    id: 'brush-how',
    region: 'status',
    item: { text: 'Path edit: Alt-drag over anchors to brush them away' },
  }],
  render: (ctx) => <BrushTrial ctx={ctx} />,
});

export function SmartRemoveBrushLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Smart remove brush" instruments={[brushInstrument]} defaultInstrument="Brush" />
    </div>
  );
}
