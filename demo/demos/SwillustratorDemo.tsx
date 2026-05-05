import { useMemo, useRef, useState } from 'react';
import {
  Canvas,
  useTools,
  useKeybindings,
  useSelectTool,
  useInsertTool,
  useHandTool,
  useTextTool,
  useUserPenTool,
  useWheelZoomTool,
  useWheelPanTool,
  useKeyboardZoomTool,
  createTextLayer,
  createPenPreviewLayer,
  createPathLayer,
  boundsOfPath,
  type PolygonPath,
  type RenderLayer,
  type TextStyle,
} from '../../src';
import type { View } from '../../src/features/viewport/view';

// --- Scene model ---
//
// Discriminated union — one items array carries both rect and text nodes.
// pose is the same `{x,y,width,height}` shape for both kinds, so the kit's
// rect-flavored move/resize/select machinery works without geometry overrides.

type Kind = 'rect' | 'text' | 'path';
interface BaseObj { id: string; kind: Kind; x: number; y: number; width: number; height: number }
interface RectObj extends BaseObj { kind: 'rect'; color: string }
interface TextObj extends BaseObj { kind: 'text'; text: string; style?: TextStyle }
interface PathObj extends BaseObj { kind: 'path'; path: PolygonPath; closed: boolean; color: string }
type Obj = RectObj | TextObj | PathObj;
interface Pose { x: number; y: number; width: number; height: number }

const W = 600, H = 400;
const RECT_COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#d47a7a', '#7ab8d4'];

const INITIAL: Obj[] = [
  { id: 'r0', kind: 'rect', x: 60, y: 80, width: 100, height: 60, color: RECT_COLORS[0] },
  { id: 't0', kind: 'text', x: 200, y: 90, width: 220, height: 40, text: 'Swillustrator', style: { fontSize: 22, fontWeight: 700, fill: { fill: 'solid', color: '#d4c4a8' } } },
];

const TOOL_ORDER: { id: string; label: string; key: string }[] = [
  { id: 'select', label: 'Select', key: 'V' },
  { id: 'insert', label: 'Rect',   key: 'R' },
  { id: 'text',   label: 'Text',   key: 'T' },
  { id: 'pen',    label: 'Pen',    key: 'P' },
  { id: 'hand',   label: 'Hand',   key: 'H' },
];

export function SwillustratorDemo() {
  const [items, setItems] = useState<Obj[]>(INITIAL);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const nextId = useRef(1);

  // Adapter — single source for select / insert / hand-aware reads.
  const adapter = {
    getObject: (id: string) => itemsRef.current.find((o) => o.id === id),
    getObjects: () => itemsRef.current,
    getPose: (id: string): Pose => {
      const o = itemsRef.current.find((x) => x.id === id);
      return o ? { x: o.x, y: o.y, width: o.width, height: o.height } : { x: 0, y: 0, width: 0, height: 0 };
    },
    getParent: () => null,
    setParent: () => {},
    setPose: (id: string, pose: Pose) =>
      setItems((cur) => cur.map((o) => (o.id === id ? { ...o, ...pose } : o))),
    insertObject: (o: Obj) => setItems((cur) => [...cur, o]),
    removeObject: (id: string) => setItems((cur) => cur.filter((o) => o.id !== id)),
    getSelection: () => [] as string[],
    setSelection: () => {},
    hitTestArea: (rect: Pose) =>
      itemsRef.current
        .filter((o) => o.x < rect.x + rect.width && o.x + o.width > rect.x && o.y < rect.y + rect.height && o.y + o.height > rect.y)
        .map((o) => o.id),
    applyOps: () => {},
    // commitInsert is the rect-tool drag-finish factory.
    commitInsert: (b: Pose): Obj => {
      const id = `r${nextId.current++}`;
      return { id, kind: 'rect', x: b.x, y: b.y, width: b.width, height: b.height, color: RECT_COLORS[nextId.current % RECT_COLORS.length] };
    },
    commitPaste: () => [] as Obj[],
    snapshotSelection: () => ({ items: [] }),
  };

  const select = useSelectTool<Obj, Pose>(adapter, {
    pickEvery: (wx, wy) =>
      itemsRef.current
        .filter((o) => wx >= o.x && wx <= o.x + o.width && wy >= o.y && wy <= o.y + o.height)
        .map((o) => o.id),
    boundsOf: (id) => {
      const o = itemsRef.current.find((x) => x.id === id);
      return o ? { x: o.x, y: o.y, width: o.width, height: o.height } : null;
    },
    // Mirror the scene drawOne so move/resize/rotate ghosts render via the
    // tool overlay channel. Text nodes fall back to a bounds outline since
    // the scene defers their pixels to the text layer.
    drawGhost: (ctx, obj, pose) => {
      if (!obj) return;
      if (obj.kind === 'rect') {
        ctx.fillStyle = obj.color;
        ctx.fillRect(pose.x, pose.y, pose.width, pose.height);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#d4c4a8';
        ctx.strokeRect(pose.x + 0.5, pose.y + 0.5, pose.width, pose.height);
      } else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#d4c4a8';
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(pose.x + 0.5, pose.y + 0.5, pose.width, pose.height);
        ctx.setLineDash([]);
      }
    },
    getObject: (id) => itemsRef.current.find((o) => o.id === id) ?? null,
  });

  const insert = useInsertTool<Obj, Pose>(adapter, { minBounds: { width: 4, height: 4 } });
  const hand = useHandTool();
  const text = useTextTool<TextObj>({
    pointInsert: ({ x, y }) => {
      const id = `t${nextId.current++}`;
      return {
        id, kind: 'text',
        x, y, width: 180, height: 28,
        text: 'New text',
        style: { fontSize: 16, fill: { fill: 'solid', color: '#d4c4a8' } },
      };
    },
  });
  const wheelZoom = useWheelZoomTool();
  const wheelPan = useWheelPanTool();
  const keyZoom = useKeyboardZoomTool();

  const pen = useUserPenTool<PathObj>({
    wrapPath: (path, { closed }): PathObj => {
      const b = boundsOfPath(path);
      const id = `p${nextId.current++}`;
      return { id, kind: 'path', x: b.x, y: b.y, width: b.width, height: b.height, path, closed, color: '#d4c4a8' };
    },
    adapter: {
      addObject: (pose) => {
        setItems((cur) => [...cur, pose]);
        return pose.id;
      },
      setSelection: () => {}, // demo wires no selection state for new paths
    },
  });

  const tools = useTools({
    active: 'select',
    registry: { select, insert, hand, text, pen },
    alwaysOn: [wheelZoom, wheelPan, keyZoom],
  });
  // useSelectTool / useInsertTool ship without keybindings — palette demos
  // wire them via overrides. useTextTool (T), useHandTool (H), useUserPenTool (P) come pre-bound.
  useKeybindings(tools, { overrides: { v: 'select', V: 'select', r: 'insert', R: 'insert' } });

  // Custom text layer — renders only the text-kind items. Rects are drawn in
  // the scene slot via drawOne, so each kind owns its own layer.
  const textLayer: RenderLayer<unknown> = createTextLayer<TextObj>({
    getTexts: () => itemsRef.current.filter((o): o is TextObj => o.kind === 'text'),
    getPose: (n) => ({ x: n.x, y: n.y, width: n.width, height: n.height, text: n.text, style: n.style }),
  });

  const pathLayer: RenderLayer<unknown> = createPathLayer<PathObj>({
    id: 'paths',
    label: 'Paths',
    getNodes: () => itemsRef.current.filter((o): o is PathObj => o.kind === 'path'),
    getPath: (n) => n.path,
    getFill: (n) => n.closed ? { fill: 'solid', color: n.color, alpha: 0.25 } : null,
    getStroke: (n) => ({ paint: { fill: 'solid', color: n.color }, width: 1 }),
  });

  // Preview layer — re-create each render so it captures the current pen tool ref.
  const penPreview: RenderLayer<unknown> = useMemo(
    () => createPenPreviewLayer({ penTool: pen }),
    [pen],
  );

  const activeOrEngaged = tools.modifierEngaged ?? tools.active;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {TOOL_ORDER.map((t) => {
          const isActive = activeOrEngaged === t.id;
          return (
            <button
              key={t.id}
              onClick={() => tools.setActive(t.id)}
              style={{
                padding: '4px 10px',
                background: isActive ? '#d4c4a8' : 'transparent',
                color: isActive ? '#1a130d' : '#d4c4a8',
                border: '1px solid #d4c4a8',
                borderRadius: 4,
                fontFamily: 'monospace',
                cursor: 'pointer',
              }}
            >
              {t.label} <span style={{ opacity: 0.6 }}>({t.key})</span>
            </button>
          );
        })}
        <span style={{ fontFamily: 'monospace', color: '#d4c4a8', marginLeft: 12 }}>
          tool: {activeOrEngaged}
        </span>
        <button
          onClick={() => setView({ x: 0, y: 0, scale: 1 })}
          style={{ marginLeft: 'auto', color: '#d4c4a8', background: 'transparent', border: '1px solid #d4c4a8', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}
        >
          Reset view
        </button>
      </div>
      <Canvas
        width={W}
        height={H}
        items={items}
        setItems={setItems}
        view={view}
        onViewChange={setView}
        tools={tools}
        background="#1a130d"
        layers={{
          scene: {
            drawOne: (ctx, _obj, pose) => {
              const o = pose as unknown as Obj;
              if (o.kind === 'rect') {
                ctx.fillStyle = o.color;
                ctx.fillRect(o.x, o.y, o.width, o.height);
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#d4c4a8';
                ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.width, o.height);
              }
              // Text nodes are drawn by the text layer, not here.
            },
          },
          text: { layer: textLayer, before: 'selectionOverlay' },
          paths: { layer: pathLayer, before: 'selectionOverlay' },
          penPreview: { layer: penPreview, before: 'selectionOverlay' },
          selectionOverlay: {},
        }}
      />
    </div>
  );
}

export const SWILLUSTRATOR_DEMO_SOURCE = `// 5-tool palette: select / insert (rect) / text / pen / hand. Wheel + keyboard zoom always-on.
const select = useSelectTool(adapter, { hitBody, boundsOf });
const insert = useInsertTool(adapter, { minBounds: { width: 4, height: 4 } });
const text   = useTextTool({ commitInsert: ({ worldX, worldY }) => ({ id, kind: 'text', ... }) });
const pen    = useUserPenTool({ wrapPath, adapter: { addObject, setSelection } });
const hand   = useHandTool();

const tools = useTools({
  active: 'select',
  registry: { select, insert, hand, text, pen },
  alwaysOn: [useWheelZoomTool(), useWheelPanTool(), useKeyboardZoomTool()],
});
useKeybindings(tools);

// UI: read tools.modifierEngaged ?? tools.active for the highlighted button.
{TOOL_ORDER.map((t) => (
  <button onClick={() => tools.setActive(t.id)} ... />
))}

<Canvas tools={tools} layers={{
  scene: { drawOne },
  text: { layer: textLayer },
  paths: { layer: createPathLayer({ getNodes, getPath, getStroke }) },
  penPreview: { layer: createPenPreviewLayer({ penTool: pen }) },
}} />`;
