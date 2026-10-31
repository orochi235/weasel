import { type ActionTunings, asNodeId, boundsOfPath, createScene, type PathEditHost, pathFromD, type RectPose, solid, useLatest } from '@weasel-js/core';
import { simplifyBrushPreset, useSimplifyBrushTool } from '@weasel-js/path-tools';
import {
  type ConfigOf, defineInstrument, f, Lab, type RenderContext, type SceneTrialState,
  TrialSceneCanvas, useTrialScene,
} from '@weasel-js/labkit';
import { createModeRegistry, DEFAULT_MODES } from '@weasel-js/modes';
import { useMemo, useState } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const FEATURES = ['draw', simplifyBrushPreset] as const;

const config = f.schema({
  radiusPx: f.number(16).range(4, 60).step(1).suffix('px').label('Brush radius'),
  // The Simplify command's own range and default, in world units off the original.
  tolerance: f.number(1).range(0.1, 20).step(0.1).label('Tolerance'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

type Point = { x: number; y: number };

const r2 = (n: number) => n.toFixed(2);

/** A freehand-style loop sampled every couple of units as straight segments,
 *  the way a pencil records one: almost every anchor is redundant. */
function scribbleD(): string {
  const pts: Point[] = [];
  for (let i = 0; i <= 240; i++) {
    const t = (i / 240) * Math.PI * 2.4;
    pts.push({ x: 60 + i * 1.5 + 30 * Math.sin(t * 2), y: 150 + 70 * Math.sin(t) + 25 * Math.cos(t * 3) });
  }
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${r2(p.x)} ${r2(p.y)}`).join(' ');
}

/** A cog: a ring of small square teeth on a circle, each tooth's corners a
 *  feature a deleting brush would erase and a simplifying one keeps. */
function cogD(cx: number, cy: number): string {
  const teeth = 12;
  const inner = 70, outer = 84;
  const parts: string[] = [];
  for (let k = 0; k < teeth; k++) {
    const a0 = (k / teeth) * Math.PI * 2;
    const step = (Math.PI * 2) / teeth;
    const ring = [
      [inner, a0], [inner, a0 + step * 0.25], [inner, a0 + step * 0.5],
      [outer, a0 + step * 0.5], [outer, a0 + step * 0.75], [inner, a0 + step * 0.75],
    ] as const;
    for (const [rad, a] of ring) {
      parts.push(`${parts.length === 0 ? 'M' : 'L'}${r2(cx + rad * Math.cos(a))} ${r2(cy + rad * Math.sin(a))}`);
    }
  }
  return `${parts.join(' ')} Z`;
}

export const SEEDED_PATH_ID = 'scribble';

const pathNode = (id: string, d: string, fill: string | null, stroke = { color: '#1a130d', width: 2 }) => {
  const path = pathFromD(d);
  return {
    id: asNodeId(id),
    kind: 'mark' as const,
    layer: 'default' as const,
    pose: boundsOfPath(path),
    data: {
      path,
      ...(fill ? { fill: { paint: solid(fill) } } : {}),
      stroke: { paint: solid(stroke.color), width: stroke.width },
    },
  };
};

const createLabScene = () =>
  createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      pathNode(SEEDED_PATH_ID, scribbleD(), null, { color: '#d9480f', width: 3 }),
      pathNode('cog', cogD(520, 340), '#e0a458'),
    ],
  });

/**
 * Path edit as a mode the trial holds, its target the open path. The mode
 * starts on the Anchors tool and leaving it puts back the tool it replaced;
 * the trial palette and the canvas share one active tool.
 */
function usePathEdit(seeded: string) {
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
  const { modes, pathEdit } = usePathEdit(SEEDED_PATH_ID);
  const simplifyBrush = useSimplifyBrushTool();
  const tools = useMemo(() => ({ simplifyBrush }), [simplifyBrush]);
  const brush = useLatest(ctx.config);
  // Thunked, so a change reaches a stroke already under way.
  const tune = useMemo<ActionTunings>(() => ({
    simplifyBrush: {
      params: () => ({ radiusPx: brush.current.radiusPx, tolerance: brush.current.tolerance }),
    },
  }), [brush]);
  const selectionOptions = useMemo(() => ({ initial: [asNodeId(SEEDED_PATH_ID)] }), []);

  return (
    <TrialSceneCanvas
      features={FEATURES}
      scene={scene}
      trial={ctx.trial}
      modes={modes}
      pathEdit={pathEdit}
      tools={tools}
      tune={tune}
      selectionOptions={selectionOptions}
    />
  );
}

const brushInstrument = defineInstrument<State, Config>({
  name: 'Simplify brush',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: 'anchors', label: 'Anchors', icon: icon('core:anchors'), shortcut: 'A' },
      { id: 'simplifyBrush', label: 'Simplify brush', icon: icon('core:simplifyBrush') },
    ],
    initial: 'simplifyBrush',
  },
  render: (ctx) => <BrushTrial ctx={ctx} />,
});

export function SimplifyBrushLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Simplify brush" instruments={[brushInstrument]} defaultInstrument="Simplify brush" />
    </div>
  );
}
