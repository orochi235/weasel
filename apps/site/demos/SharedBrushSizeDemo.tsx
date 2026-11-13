import { useMemo, useState, type ReactNode } from 'react';
import {
  type Action, type BindingOpts, commitOps, createDeleteOp, createInsertOp, createToolOptionValues, defineTool, ellipsePath,
  type InvocationCtx, type RectPose, resolveParams, SceneCanvas, setToolOption, shareToolOptions, solid, type Tool,
  type ToolOptions, type ToolOptionShare, type ToolOptionValues, type ToolsApi, useScene, useSelection,
  useToolOptionParams, useToolOptionValues,
} from '@weasel-js/core';
import { pxReach } from '@weasel-js/geom';
import { pref } from '@weasel-js/prefs';
import { brushRing } from '@weasel-js/cursor';
import { shareBrushSize } from '@weasel-js/brush';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { ToolOptionsBar } from '@weasel-js/ui/components/ToolOptionsBar';

type Point = { x: number; y: number };
const DOT = '#5b7bd5';

type Act = (ctx: InvocationCtx, at: Point[], radius: number) => void;

/** A round brush whose drag runs `act` on the release, with the stroke's points and its radius in world units.
 *  `share` is laid over its options: sharing its size makes it every sharing brush's size. */
function brushTool(id: string, label: string, act: Act, share?: ToolOptionShare): Tool {
  const prefs = pref.group(label, {
    radiusPx: pref.number('Size', 16, { min: 4, max: 120, step: 1, control: 'slider' }),
  });
  const own: ToolOptions = { actionId: id, prefs, size: { option: 'radiusPx', times: 1.25 } };
  const options = shareToolOptions(own, share);
  const radiusOf = (p: Readonly<Record<string, unknown>> | undefined) => (typeof p?.radiusPx === 'number' ? p.radiusPx : 16);
  const action: Action = {
    id, label, params: prefs, requires: ['scene', 'view', 'applyOps', 'selection'],
    cursor: (params) => brushRing(radiusOf(params)),
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx, opts?: BindingOpts) {
        const radiusPx = radiusOf(resolveParams(opts?.params));
        const trail: Point[] = [ctx.world];
        return {
          cursor: () => brushRing(radiusPx),
          overlay: () => ({ kind: 'brush', points: trail, radiusPx }),
          onMove: (move: InvocationCtx) => { trail.push(move.world); },
          onEnd: (_end: InvocationCtx, reason: 'commit' | 'cancel') => {
                if (reason === 'commit') act(ctx, trail, pxReach(radiusPx, ctx.deps.view?.get().scale ?? { x: 1, y: 1 }));
          },
        };
      },
    },
  };
  return defineTool({ id, presentation: { label }, bindings: [{ spec: { kind: 'drag' }, actionId: id }], actions: [action], options });
}

/** One dot per radius of travel along the stroke. */
const dots: Act = ({ deps }, trail, r) => {
  const scene = deps.scene!;
  const ops = [];
  let last: Point | null = null;
  for (const p of trail) {
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < r) continue;
    last = p;
    const pose = { x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r };
    const node = { id: scene.mintId(), kind: 'mark', layer: 'default', parent: null, pose, data: { path: ellipsePath(pose), fill: { paint: solid(DOT) } } };
    ops.push(createInsertOp({ node, label: 'Dots' }));
  }
  commitOps(deps, ops, 'Dots');
};

/** Every dot whose center the stroke passed within its radius. */
const erase: Act = ({ deps }, trail, r) => {
  const scene = deps.scene!;
  const hit = [...scene.nodes.values()].filter((n) => {
    const b = n.pose as RectPose;
    const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    return trail.some((p) => Math.hypot(p.x - c.x, p.y - c.y) <= r);
  });
  commitOps(deps, hit.map((node) => createDeleteOp({ node, label: 'Erase' })), 'Erase');
};

/** Both brushes, their sizes shared or each its own. */
function brushes(shared: boolean): Record<string, Tool> {
  const share = shared ? shareBrushSize({ size: { option: 'radiusPx' } }) : undefined;
  return { dots: brushTool('dots', 'Dots', dots, share), erase: brushTool('erase', 'Erase', erase, share) };
}

/** Publishes where the tools keep their options, from inside the canvas. */
function OptionValues({ values }: { values: ToolOptionValues }): ReactNode {
  useToolOptionValues(values);
  return null;
}

function ActiveOptions({ tools, values }: { tools: ToolsApi; values: ToolOptionValues }) {
  const tool = tools.active ? tools.registry[tools.active] : undefined;
  const options = tool?.options;
  const params = useToolOptionParams(tool, values);
  if (!tool || !options || !params) return null;
  return (
    <ToolOptionsBar
      label={tool.presentation?.label}
      schema={options.prefs}
      values={params}
      onChange={(key, v) => setToolOption(tool.id, options, values, key, v)}
    />
  );
}

export function SharedBrushSizeDemo() {
  const scene = useScene({ systemLayers: [{ id: 'default' }] });
  const selection = useSelection({ scene, mode: 'multi' });
  const [tools, setTools] = useState<ToolsApi | null>(null);
  const [values] = useState(createToolOptionValues);
  const [shared, setShared] = useState(false);
  const registry = useMemo(() => brushes(shared), [shared]);
  return (
    <div className="ckd-shape-tools-demo">
      {tools && <ToolPalette tools={tools} orientation="horizontal" />}
      <label>
        <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Share brush size
      </label>
      {tools && <ActiveOptions tools={tools} values={values} />}
      <div className="ckd-canvas-frame">
        <SceneCanvas
          width={520}
          height={300}
          className="ckd-canvas"
          backgroundFill={{ color: '#f4f1ea' }}
          scene={scene}
          selection={selection}
          tools={registry}
          defaultActiveTool="dots"
          onToolsCreated={setTools}
        >
          <OptionValues values={values} />
        </SceneCanvas>
      </div>
    </div>
  );
}
