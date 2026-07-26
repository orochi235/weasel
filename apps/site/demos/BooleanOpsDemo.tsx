import { useCallback, useMemo, useRef } from 'react';
import {
  pathUnion,
  pathIntersect,
  pathSubtract,
  pathExclude,
  pathDivide,
  useBooleansAdapter,
  useStandardActions,
  useSelection,
  SelectionContextProvider,
  DepRegistryProvider,
  PATH_M,
  PATH_L,
  PATH_Z,
  SceneCanvas,
  useScene,
  asNodeId,
} from '@weasel-js/core';
import type { BooleansAdapter, NodeId, Op, PolygonPath } from '@weasel-js/core';
import { ActionBar } from '@weasel-js/ui';
import type { DrawCommand } from '@weasel-js/core/renderer';

const W = 240;
const H = 200;

/** 32-gon circle approximation centered at (cx, cy). */
function circle(cx: number, cy: number, r: number, n = 32): PolygonPath {
  const commands = new Uint8Array(n + 1);
  const coords = new Float32Array(n * 2);
  commands[0] = PATH_M;
  for (let i = 1; i < n; i++) commands[i] = PATH_L;
  commands[n] = PATH_Z;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    coords[i * 2] = cx + Math.cos(t) * r;
    coords[i * 2 + 1] = cy + Math.sin(t) * r;
  }
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

const RECT_INPUT: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
  coords: new Float32Array([40, 50, 140, 50, 140, 140, 40, 140]),
  fillRule: 'nonzero',
};
const CIRCLE_INPUT = circle(120, 115, 55);

const RECT_COLOR = '#7fb069';
const CIRCLE_COLOR = '#d4a574';
const RESULT_COLOR = '#a48bd4';
const DIVIDE_COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#7ab8d4', '#d47a7a'];

interface PanelItem {
  id: string;
  path: PolygonPath;
  color: string;
}

// Nodes use the path itself as their pose so SceneCanvas's built-in
// path-pose hit-tester picks them up without a custom pickEvery.
const INITIAL_NODES = [
  {
    kind: 'leaf' as const,
    layer: 'default' as const,
    id: asNodeId('rect'),
    pose: RECT_INPUT,
    data: { id: 'rect', path: RECT_INPUT, color: RECT_COLOR },
  },
  {
    kind: 'leaf' as const,
    layer: 'default' as const,
    id: asNodeId('circle'),
    pose: CIRCLE_INPUT,
    data: { id: 'circle', path: CIRCLE_INPUT, color: CIRCLE_COLOR },
  },
];

function Panel({ id, paths }: { id: string; paths: PanelItem[] }) {
  const scene = useScene<PanelItem>({ items: paths });
  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selectionMode="multi"
      layers={{
        scene: {
          drawOne: (node): DrawCommand[] => [{
            kind: 'path',
            path: node.data.path,
            fill: { color: node.data.color },
          }],
        },
      }}
      data-panel={id}
    />
  );
}

function InteractivePanel() {
  const scene = useScene<PanelItem, 'default', PolygonPath>({
    systemLayers: [{ id: 'default' }],
    initial: INITIAL_NODES,
  });

  const selection = useSelection({
    mode: 'multi',
    initial: [asNodeId('rect'), asNodeId('circle')],
  });

  const nextIdRef = useRef(0);
  const pendingPathsRef = useRef<Map<string, PolygonPath>>(new Map());

  // All mutable state accessed through refs so adapter is constructed once.
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const adapterRef = useRef<BooleansAdapter | null>(null);
  if (adapterRef.current === null) {
    adapterRef.current = {
      getSelection: () => selectionRef.current.get(),
      getWorldPath: (id: NodeId) => sceneRef.current.get(id)?.data.path,
      compareZ: (a: NodeId, b: NodeId) => {
        const order = [...sceneRef.current.renderOrder()];
        return order.indexOf(a) - order.indexOf(b);
      },
      createPathNode: (path) => {
        const id = `result-${nextIdRef.current++}`;
        pendingPathsRef.current.set(id, path as PolygonPath);
        return { id };
      },
      insertNode: (node: { id: string }) => {
        const path = pendingPathsRef.current.get(node.id);
        if (!path) return;
        pendingPathsRef.current.delete(node.id);
        sceneRef.current.add({
          kind: 'leaf',
          layer: 'default',
          id: asNodeId(node.id),
          pose: path,
          data: { id: node.id, path, color: RESULT_COLOR },
        });
      },
      removeNode: (id: string) => {
        sceneRef.current.remove(asNodeId(id));
      },
      setSelection: (ids: NodeId[]) => {
        selectionRef.current.set(ids);
      },
      applyOps: (ops: Op[]) => {
        for (const op of ops) op.apply(adapterRef.current!);
      },
    };
  }
  const adapter = adapterRef.current;

  // Register the kit-standard action descriptors (including pathfinder.*)
  // with the ambient ActionsProvider, and publish the booleansAdapter dep so
  // their invokers can reach this panel's adapter. Together these power the
  // <ActionBar group="pathfinder"/> below.
  useStandardActions({ selection });
  useBooleansAdapter(adapter);

  const reset = useCallback(() => {
    // Remove all current nodes
    for (const id of [...scene.renderOrder()]) {
      scene.remove(id);
    }
    // Re-add initial nodes
    scene.add({
      kind: 'leaf',
      layer: 'default',
      id: asNodeId('rect'),
      pose: RECT_INPUT,
      data: { id: 'rect', path: RECT_INPUT, color: RECT_COLOR },
    });
    scene.add({
      kind: 'leaf',
      layer: 'default',
      id: asNodeId('circle'),
      pose: CIRCLE_INPUT,
      data: { id: 'circle', path: CIRCLE_INPUT, color: CIRCLE_COLOR },
    });
    nextIdRef.current = 0;
    pendingPathsRef.current.clear();
    selection.set([asNodeId('rect'), asNodeId('circle')]);
  }, [scene, selection]);

  return (
    // Wrap in its own SelectionContextProvider so this canvas's non-empty
    // initial selection doesn't fight with the 6 static panels (which all
    // publish an empty selection) over the shared outer context.
    <SelectionContextProvider>
      <div className="ckd-boolops-panel">
        <h3 className="ckd-boolops-label">Interactive</h3>
        <div className="ckd-boolops-toolbar">
          <ActionBar group="pathfinder" />
          <button type="button" className="ckd-boolops-reset" onClick={reset}>
            Reset
          </button>
        </div>
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          layers={{
            scene: {
              drawOne: (node): DrawCommand[] => [{
                kind: 'path',
                path: node.data.path,
                fill: { color: node.data.color },
              }],
            },
          }}
          data-panel="interactive"
        />
      </div>
    </SelectionContextProvider>
  );
}

export function BooleanOpsDemo() {
  const unionResult = useMemo(() => pathUnion(RECT_INPUT, CIRCLE_INPUT), []);
  const intersectResult = useMemo(() => pathIntersect(RECT_INPUT, CIRCLE_INPUT), []);
  const subtractResult = useMemo(() => pathSubtract(RECT_INPUT, CIRCLE_INPUT), []);
  const excludeResult = useMemo(() => pathExclude(RECT_INPUT, CIRCLE_INPUT), []);
  const divideResults = useMemo(() => pathDivide(RECT_INPUT, CIRCLE_INPUT), []);

  const dividePaths = useMemo(
    () => divideResults.map((p, i) => ({
      id: `d${i}`,
      path: p,
      color: DIVIDE_COLORS[i % DIVIDE_COLORS.length],
    })),
    [divideResults],
  );

  return (
    <div className="ckd-boolops-grid">
      {/* useBooleansAdapter / useStandardActions inside InteractivePanel both
          publish into the dep registry, which would otherwise be auto-mounted
          by SceneCanvas's DepRegistryProviderIfRoot. Since the hooks run
          BEFORE InteractivePanel's SceneCanvas mounts, hoist the provider
          here so the registry is in scope when the hooks fire. */}
      <DepRegistryProvider>
        <InteractivePanel />
      </DepRegistryProvider>

      <div className="ckd-boolops-panel">
        <h3 className="ckd-boolops-label">Inputs</h3>
        <Panel id="inputs" paths={[
          { id: 'rect', path: RECT_INPUT, color: RECT_COLOR },
          { id: 'circle', path: CIRCLE_INPUT, color: CIRCLE_COLOR },
        ]} />
      </div>

      <div className="ckd-boolops-panel">
        <h3 className="ckd-boolops-label">Union</h3>
        <Panel id="union" paths={[{ id: 'u', path: unionResult, color: RESULT_COLOR }]} />
      </div>

      <div className="ckd-boolops-panel">
        <h3 className="ckd-boolops-label">Intersect</h3>
        <Panel id="intersect" paths={[{ id: 'i', path: intersectResult, color: RESULT_COLOR }]} />
      </div>

      <div className="ckd-boolops-panel">
        <h3 className="ckd-boolops-label">Subtract</h3>
        <Panel id="subtract" paths={[{ id: 's', path: subtractResult, color: RESULT_COLOR }]} />
      </div>

      <div className="ckd-boolops-panel">
        <h3 className="ckd-boolops-label">Exclude</h3>
        <Panel id="exclude" paths={[{ id: 'x', path: excludeResult, color: RESULT_COLOR }]} />
      </div>

      <div className="ckd-boolops-panel">
        <h3 className="ckd-boolops-label">Divide</h3>
        <Panel id="divide" paths={dividePaths} />
      </div>
    </div>
  );
}
