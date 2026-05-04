import { useMemo, useRef, useState } from 'react';
import {
  Canvas,
  useTools,
  useKeybindings,
  useSelection,
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
} from '@orochi235/weasel';
interface View { x: number; y: number; scale: number }

// US Letter at 96dpi.
const PAGE_W = 816;
const PAGE_H = 1056;

type Kind = 'rect' | 'text' | 'path';
interface BaseObj { id: string; kind: Kind; x: number; y: number; width: number; height: number }
interface RectObj extends BaseObj { kind: 'rect'; fill: string; stroke: string; strokeWidth: number }
interface TextObj extends BaseObj { kind: 'text'; text: string; style?: TextStyle }
interface PathObj extends BaseObj { kind: 'path'; path: PolygonPath; closed: boolean; fill: string; stroke: string; strokeWidth: number }
type Obj = RectObj | TextObj | PathObj;
interface Pose { x: number; y: number; width: number; height: number }

const TOOL_ORDER: { id: string; label: string; key: string }[] = [
  { id: 'select', label: 'Select', key: 'V' },
  { id: 'insert', label: 'Rect',   key: 'R' },
  { id: 'text',   label: 'Text',   key: 'T' },
  { id: 'pen',    label: 'Pen',    key: 'P' },
  { id: 'hand',   label: 'Hand',   key: 'H' },
];

export function App() {
  const [items, setItems] = useState<Obj[]>([]);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [fillColor, setFillColor] = useState('#7fb069');
  const [strokeColor, setStrokeColor] = useState('#1a130d');
  const [strokeWidth, setStrokeWidth] = useState(1);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const selection = useSelection({ mode: 'multi' });
  const fillRef = useRef(fillColor);
  fillRef.current = fillColor;
  const strokeRef = useRef(strokeColor);
  strokeRef.current = strokeColor;
  const strokeWidthRef = useRef(strokeWidth);
  strokeWidthRef.current = strokeWidth;
  const nextId = useRef(1);

  const adapterRef = useRef<typeof adapter | null>(null);
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
    getSelection: () => selection.current,
    setSelection: (ids: string[]) => selection.set(ids),
    hitTestArea: (rect: Pose) =>
      itemsRef.current
        .filter((o) => o.x < rect.x + rect.width && o.x + o.width > rect.x && o.y < rect.y + rect.height && o.y + o.height > rect.y)
        .map((o) => o.id),
    applyOps: () => {},
    applyBatch: (ops: { apply: (a: unknown) => void }[]) => {
      for (const op of ops) op.apply(adapterRef.current);
    },
    commitInsert: (b: Pose): Obj => {
      const id = `r${nextId.current++}`;
      return {
        id, kind: 'rect',
        x: b.x, y: b.y, width: b.width, height: b.height,
        fill: fillRef.current, stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
      };
    },
    commitPaste: () => [] as Obj[],
    snapshotSelection: () => ({ items: [] }),
  };
  adapterRef.current = adapter;

  const select = useSelectTool<Obj, Pose>(adapter, {
    hitBody: (wx, wy) =>
      itemsRef.current
        .filter((o) => wx >= o.x && wx <= o.x + o.width && wy >= o.y && wy <= o.y + o.height)
        .map((o) => o.id),
    boundsOf: (id) => {
      const o = itemsRef.current.find((x) => x.id === id);
      return o ? { x: o.x, y: o.y, width: o.width, height: o.height } : null;
    },
    drawGhost: (ctx, obj, pose) => {
      if (!obj) return;
      if (obj.kind === 'rect') {
        ctx.fillStyle = obj.fill;
        ctx.fillRect(pose.x, pose.y, pose.width, pose.height);
        ctx.lineWidth = obj.strokeWidth;
        ctx.strokeStyle = obj.stroke;
        ctx.strokeRect(pose.x + 0.5, pose.y + 0.5, pose.width, pose.height);
      } else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#888';
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
    commitInsert: ({ worldX, worldY }) => {
      const id = `t${nextId.current++}`;
      return {
        id, kind: 'text',
        x: worldX, y: worldY, width: 180, height: 28,
        text: 'New text',
        style: { fontSize: 16, fill: { fill: 'solid', color: fillRef.current } },
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
      return {
        id, kind: 'path',
        x: b.x, y: b.y, width: b.width, height: b.height,
        path, closed,
        fill: fillRef.current, stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
      };
    },
    adapter: {
      addObject: (pose) => {
        setItems((cur) => [...cur, pose]);
        return pose.id;
      },
      setSelection: () => {},
    },
  });

  const tools = useTools({
    active: 'select',
    registry: { select, insert, hand, text, pen },
    alwaysOn: [wheelZoom, wheelPan, keyZoom],
  });
  useKeybindings(tools, { overrides: { v: 'select', V: 'select', r: 'insert', R: 'insert' } });

  const textLayer: RenderLayer<unknown> = createTextLayer<TextObj>({
    getTexts: () => itemsRef.current.filter((o): o is TextObj => o.kind === 'text'),
    getPose: (n) => ({ x: n.x, y: n.y, width: n.width, height: n.height, text: n.text, style: n.style }),
  });

  const pathLayer: RenderLayer<unknown> = createPathLayer<PathObj>({
    id: 'paths',
    label: 'Paths',
    getNodes: () => itemsRef.current.filter((o): o is PathObj => o.kind === 'path'),
    getPath: (n) => n.path,
    getFill: (n) => n.closed ? { fill: 'solid', color: n.fill, alpha: 0.6 } : null,
    getStroke: (n) => ({ paint: { fill: 'solid', color: n.stroke }, width: n.strokeWidth }),
  });

  const penPreview: RenderLayer<unknown> = useMemo(
    () => createPenPreviewLayer({ penTool: pen }),
    [pen],
  );

  const activeOrEngaged = tools.modifierEngaged ?? tools.active;

  // --- Selection-aware mutation helpers ---
  // Re-read items each call so back-to-back changes within a render coalesce.
  const updateSelected = (patch: (o: Obj) => Obj): void => {
    const ids = new Set(selection.current);
    if (ids.size === 0) return;
    setItems((cur) => cur.map((o) => (ids.has(o.id) ? patch(o) : o)));
  };

  const selectedItems = items.filter((o) => selection.current.includes(o.id));
  const primary = selectedItems[0];
  const hasStrokeProps = primary && primary.kind !== 'text';

  // Apply property changes to all selected items that support the property,
  // including kind-specific paths (text fill lives in style.fill.color).
  const applyFillToSelection = (color: string): void => {
    updateSelected((o) => {
      if (o.kind === 'rect' || o.kind === 'path') return { ...o, fill: color };
      if (o.kind === 'text') {
        const prevFill = o.style?.fill;
        const nextFill = prevFill && prevFill.fill === 'solid'
          ? { ...prevFill, color }
          : { fill: 'solid' as const, color };
        return { ...o, style: { ...(o.style ?? {}), fill: nextFill } };
      }
      return o;
    });
  };
  const applyStrokeToSelection = (color: string): void => {
    updateSelected((o) => (o.kind === 'rect' || o.kind === 'path') ? { ...o, stroke: color } : o);
  };
  const applyStrokeWidthToSelection = (w: number): void => {
    updateSelected((o) => (o.kind === 'rect' || o.kind === 'path') ? { ...o, strokeWidth: w } : o);
  };

  // Read primary's current values for the panel inputs.
  const primaryFill = primary
    ? (primary.kind === 'text'
        ? (primary.style?.fill?.fill === 'solid' ? primary.style.fill.color : '#000000')
        : primary.fill)
    : fillColor;
  const primaryStroke = primary && primary.kind !== 'text' ? primary.stroke : strokeColor;
  const primaryStrokeWidth = primary && primary.kind !== 'text' ? primary.strokeWidth : strokeWidth;

  return (
    <div className="swill-app">
      <div className="swill-disclaimer">
        This dumpster fire is not associated with Adobe or Illustrator. Obviously.
      </div>
      <aside className="swill-sidebar">
        <div className="swill-section-label">Tools</div>
        {TOOL_ORDER.map((t) => {
          const isActive = activeOrEngaged === t.id;
          return (
            <button
              key={t.id}
              className={`swill-tool-button${isActive ? ' active' : ''}`}
              onClick={() => tools.setActive(t.id)}
            >
              <span>{t.label}</span>
              <span className="key">{t.key}</span>
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button
          className="swill-tool-button"
          onClick={() => setView({ x: 0, y: 0, scale: 1 })}
          title="Reset view"
        >
          <span>Reset</span>
          <span className="key">view</span>
        </button>
      </aside>

      <main className="swill-stage">
        <div className="swill-page-shadow">
          <Canvas
            width={PAGE_W}
            height={PAGE_H}
            items={items}
            setItems={setItems}
            view={view}
            onViewChange={setView}
            tools={tools}
            selection={selection}
            background="#fafafa"
            layers={{
              scene: {
                drawOne: (ctx, _obj, pose) => {
                  const o = pose as unknown as Obj;
                  if (o.kind === 'rect') {
                    ctx.fillStyle = o.fill;
                    ctx.fillRect(o.x, o.y, o.width, o.height);
                    if (o.strokeWidth > 0) {
                      ctx.lineWidth = o.strokeWidth;
                      ctx.strokeStyle = o.stroke;
                      ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.width, o.height);
                    }
                  }
                },
              },
              text: { layer: textLayer, before: 'selectionOverlay' },
              paths: { layer: pathLayer, before: 'selectionOverlay' },
              penPreview: { layer: penPreview, before: 'selectionOverlay' },
              selectionOverlay: {},
            }}
          />
        </div>
      </main>

      <aside className="swill-sidebar right">
        {primary ? (
          <>
            <div className="swill-section-label">
              Selection ({selectedItems.length})
            </div>
            <div style={{ fontSize: 11, color: '#a89878', fontFamily: 'ui-monospace, monospace', marginBottom: 4 }}>
              {primary.kind}{selectedItems.length > 1 ? ` +${selectedItems.length - 1}` : ''}
            </div>

            <label className="swill-color-row">
              <input
                type="color"
                value={primaryFill}
                onChange={(e) => applyFillToSelection(e.target.value)}
              />
              <span>Fill</span>
              <code>{primaryFill}</code>
            </label>

            {hasStrokeProps && (
              <>
                <label className="swill-color-row">
                  <input
                    type="color"
                    value={primaryStroke}
                    onChange={(e) => applyStrokeToSelection(e.target.value)}
                  />
                  <span>Stroke</span>
                  <code>{primaryStroke}</code>
                </label>

                <label className="swill-color-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Stroke width</span>
                    <code>{primaryStrokeWidth}px</code>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={1}
                    value={primaryStrokeWidth}
                    onChange={(e) => applyStrokeWidthToSelection(Number(e.target.value))}
                  />
                </label>
              </>
            )}

            <button
              className="swill-tool-button"
              onClick={() => selection.clear()}
              style={{ marginTop: 4 }}
            >
              <span>Deselect</span>
            </button>
          </>
        ) : (
          <>
            <div className="swill-section-label">Defaults</div>
            <label className="swill-color-row">
              <input
                type="color"
                value={fillColor}
                onChange={(e) => setFillColor(e.target.value)}
              />
              <span>Fill</span>
              <code>{fillColor}</code>
            </label>
            <label className="swill-color-row">
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
              />
              <span>Stroke</span>
              <code>{strokeColor}</code>
            </label>
            <label className="swill-color-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Stroke width</span>
                <code>{strokeWidth}px</code>
              </span>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
              />
            </label>
          </>
        )}

        <div style={{ flex: 1 }} />
        <div className="swill-section-label">Scene</div>
        <div style={{ fontSize: 11, color: '#a89878', fontFamily: 'ui-monospace, monospace' }}>
          {items.length} object{items.length === 1 ? '' : 's'}
        </div>
      </aside>

      <div className="swill-statusbar">
        <span>tool: {activeOrEngaged}</span>
        <span>sel: {selection.current.length}</span>
        <span>fill: {fillColor}</span>
        <span>stroke: {strokeColor}</span>
        <span>zoom: {(view.scale * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}
