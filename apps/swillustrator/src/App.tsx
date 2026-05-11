import { useMemo, useRef, useState } from 'react';
import {
  asNodeId,
  Canvas,
  useTools,
  useKeybindings,
  useSelection,
  useSelectTool,
  useInsertTool,
  useHandTool,
  useTextTool,
  useUserPenTool,
  useSelectAll,
  selectFromMarquee,
  useWheelZoomTool,
  useWheelPanTool,
  useKeyboardZoomTool,
  createTextLayer,
  createPenPreviewLayer,
  createPathLayer,
  boundsOfPath,
  type NodeId,
  type PolygonPath,
  type RenderLayer,
  type TextStyle,
} from '@orochi235/weasel';
import type { DrawCommand } from '../../../src/renderer';
import {
  PropertiesPanel,
  PropertyRow,
  PropertyAxisInput,
  PropertyColorInput,
  PropertyNumberInput,
  PropertyButton,
  PropertyReadOnly,
  PropertyTextInput,
  PropertySelect,
  PropertyMiniLabel,
  PropertySwatchGrid,
} from '@orochi235/weasel-ui';
import '@orochi235/weasel-ui/tokens.css';
interface View { x: number; y: number; scale: number }

// US Letter at 96dpi.
const PAGE_W = 816;
const PAGE_H = 1056;

// Garden-ish palette borrowed from eric. Used by the Colors swatch grid.
const PALETTE: { value: string; label: string }[] = [
  { value: '#7fb069', label: 'Leaf' },
  { value: '#4a7c59', label: 'Forest' },
  { value: '#d4a574', label: 'Sand' },
  { value: '#c97c5d', label: 'Terracotta' },
  { value: '#b03030', label: 'Tomato' },
  { value: '#e8c547', label: 'Sunflower' },
  { value: '#6b8cae', label: 'Sky' },
  { value: '#3a5a7c', label: 'Indigo' },
  { value: '#8e6c8a', label: 'Plum' },
  { value: '#d4c4a8', label: 'Cream' },
  { value: '#3a2e22', label: 'Bark' },
  { value: '#1a130d', label: 'Soil' },
];

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
  const [docTitle, setDocTitle] = useState('Untitled');
  const [paperSize, setPaperSize] = useState<'letter' | 'a4' | 'legal'>('letter');
  const [gridDensity, setGridDensity] = useState(8);
  const [sidebarWidth, setSidebarWidth] = useState(240);
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
    getNode: (id: string) => itemsRef.current.find((o) => o.id === id),
    getNodes: () => itemsRef.current,
    getPose: (id: string): Pose => {
      const o = itemsRef.current.find((x) => x.id === id);
      return o ? { x: o.x, y: o.y, width: o.width, height: o.height } : { x: 0, y: 0, width: 0, height: 0 };
    },
    setPose: (id: string, pose: Pose) =>
      setItems((cur) => cur.map((o) => (o.id === id ? { ...o, ...pose } : o))),
    insertNode: (o: Obj) => setItems((cur) => [...cur, o]),
    removeNode: (id: string) => setItems((cur) => cur.filter((o) => o.id !== id)),
    getSelection: () => [...selection.current],
    setSelection: (ids: string[]) => selection.set(ids as NodeId[]),
    hitTestArea: (rect: Pose) =>
      itemsRef.current
        .filter((o) => o.x < rect.x + rect.width && o.x + o.width > rect.x && o.y < rect.y + rect.height && o.y + o.height > rect.y)
        .map((o) => o.id),
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
    pickEvery: (wx, wy) =>
      itemsRef.current
        .filter((o) => wx >= o.x && wx <= o.x + o.width && wy >= o.y && wy <= o.y + o.height)
        .map((o) => o.id),
    boundsOf: (id) => {
      const o = itemsRef.current.find((x) => x.id === id);
      return o ? { x: o.x, y: o.y, width: o.width, height: o.height } : null;
    },
    drawGhost: (obj, pose): DrawCommand[] => {
      if (!obj) return [];
      if (obj.kind === 'rect') {
        const cmds: DrawCommand[] = [{
          kind: 'path',
          path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
          fill: { color: obj.fill },
        }];
        if (obj.strokeWidth > 0) {
          cmds.push({
            kind: 'path',
            path: { kind: 'rect', x: pose.x + 0.5, y: pose.y + 0.5, width: pose.width, height: pose.height },
            stroke: { paint: { color: obj.stroke }, width: obj.strokeWidth },
          });
        }
        return cmds;
      }
      return [{
        kind: 'path',
        path: { kind: 'rect', x: pose.x + 0.5, y: pose.y + 0.5, width: pose.width, height: pose.height },
        stroke: { paint: { color: '#888' }, width: 1, dash: [3, 3] },
      }];
    },
    getNode: (id) => itemsRef.current.find((o) => o.id === id) ?? null,
    // Marquee is opt-in at the kit level — illustration apps want
    // rubber-band selection across drawn objects.
    areaSelect: { behaviors: [selectFromMarquee()] },
  });

  const insert = useInsertTool<Obj, Pose>(adapter, { minBounds: { width: 4, height: 4 } });
  const hand = useHandTool();
  const text = useTextTool<TextObj>({
    hitExisting: ({ x: worldX, y: worldY }) => {
      const hit = [...itemsRef.current].reverse().find(
        (o): o is TextObj => o.kind === 'text'
          && worldX >= o.x && worldX <= o.x + o.width
          && worldY >= o.y && worldY <= o.y + o.height,
      );
      return hit ? hit.id : null;
    },
    pointInsert: ({ x: worldX, y: worldY }) => {
      const id = `t${nextId.current++}`;
      return {
        id, kind: 'text',
        x: worldX, y: worldY, width: 180, height: 28,
        text: 'New text',
        style: { fontSize: 16, fill: { fill: 'solid', color: fillRef.current } },
      };
    },
    commitInsert: ({ x, y, width, height }) => {
      const id = `t${nextId.current++}`;
      // Match font size to box height so the text actually fills the marquee.
      // 0.7 ≈ glyph cap-height ratio for most sans-serifs; rounds to a sane
      // px size and floors at 8 so wee boxes stay readable.
      const fontSize = Math.max(8, Math.round(height * 0.7));
      return {
        id, kind: 'text',
        x, y, width, height,
        text: 'New text',
        style: { fontSize, fill: { fill: 'solid', color: fillRef.current } },
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
      addNode: (pose) => {
        setItems((cur) => [...cur, pose]);
        return pose.id;
      },
      setSelection: () => {},
    },
  });

  const tools = useTools({
    active: 'select',
    registry: { select, insert, hand, text, pen },
    ambient: [wheelZoom, wheelPan, keyZoom],
  });
  useKeybindings(tools, { overrides: { v: 'select', V: 'select', r: 'insert', R: 'insert' } });
  useSelectAll({
    getSelection: () => [...selection.current],
    listAll: () => itemsRef.current.map((o) => asNodeId(o.id)),
    setSelection: (ids) => selection.set(ids),
  });

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

  const activeOrEngaged = tools.hotkeyEngaged ?? tools.active;

  // --- Selection-aware mutation helpers ---
  // Re-read items each call so back-to-back changes within a render coalesce.
  const updateSelected = (patch: (o: Obj) => Obj): void => {
    const ids = new Set<string>(selection.current);
    if (ids.size === 0) return;
    setItems((cur) => cur.map((o) => (ids.has(o.id) ? patch(o) : o)));
  };

  const selectedItems = items.filter((o) => (selection.current as readonly string[]).includes(o.id));
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
                drawOne: (_obj, pose): DrawCommand[] => {
                  const o = pose as unknown as Obj;
                  if (o.kind !== 'rect') return [];
                  const cmds: DrawCommand[] = [{
                    kind: 'path',
                    path: { kind: 'rect', x: o.x, y: o.y, width: o.width, height: o.height },
                    fill: { color: o.fill },
                  }];
                  if (o.strokeWidth > 0) {
                    cmds.push({
                      kind: 'path',
                      path: { kind: 'rect', x: o.x + 0.5, y: o.y + 0.5, width: o.width, height: o.height },
                      stroke: { paint: { color: o.stroke }, width: o.strokeWidth },
                    });
                  }
                  return cmds;
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

      <div
        className="swill-sidebar-resize"
        onPointerDown={(e) => {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          const startX = e.clientX;
          const startW = sidebarWidth;
          const move = (ev: PointerEvent) => {
            const next = Math.max(180, Math.min(400, startW + (startX - ev.clientX)));
            setSidebarWidth(next);
          };
          const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        }}
      />
      <aside className="swill-sidebar right" style={{ width: sidebarWidth }}>
        {primary ? (
          <PropertiesPanel title={`Selection (${selectedItems.length})`}>
            <PropertyRow label="Kind">
              <PropertyReadOnly>
                {primary.kind}{selectedItems.length > 1 ? ` +${selectedItems.length - 1}` : ''}
              </PropertyReadOnly>
            </PropertyRow>
            <PropertyRow label="Position">
              <PropertyAxisInput axis="X" value={Math.round(primary.x)} onChange={(v) => updateSelected((o) => ({ ...o, x: v }))} />
              <PropertyAxisInput axis="Y" value={Math.round(primary.y)} onChange={(v) => updateSelected((o) => ({ ...o, y: v }))} />
            </PropertyRow>
            <PropertyRow label="Size">
              <PropertyAxisInput axis="W" value={Math.round(primary.width)} onChange={(v) => updateSelected((o) => ({ ...o, width: Math.max(1, v) }))} min={1} />
              <PropertyAxisInput axis="H" value={Math.round(primary.height)} onChange={(v) => updateSelected((o) => ({ ...o, height: Math.max(1, v) }))} min={1} />
            </PropertyRow>
            <PropertyRow label="Fill">
              <PropertyColorInput value={primaryFill} onChange={applyFillToSelection} />
            </PropertyRow>
            {hasStrokeProps && (
              <>
                <PropertyRow label="Stroke">
                  <PropertyColorInput value={primaryStroke} onChange={applyStrokeToSelection} />
                </PropertyRow>
                <PropertyRow label="Width">
                  <PropertyNumberInput value={primaryStrokeWidth} onChange={applyStrokeWidthToSelection} min={0} max={20} step={1} span={4} />
                </PropertyRow>
              </>
            )}
            <PropertyRow>
              <PropertyButton onClick={() => selection.clear()} span={6}>Deselect</PropertyButton>
              <PropertyButton
                variant="danger"
                span={6}
                onClick={() => {
                  const ids = new Set<string>(selection.current);
                  setItems((cur) => cur.filter((o) => !ids.has(o.id)));
                  selection.clear();
                }}
              >
                Delete
              </PropertyButton>
            </PropertyRow>
          </PropertiesPanel>
        ) : (
          <PropertiesPanel title="Defaults">
            <PropertyRow label="Fill">
              <PropertyColorInput value={fillColor} onChange={setFillColor} />
            </PropertyRow>
            <PropertyRow label="Stroke">
              <PropertyColorInput value={strokeColor} onChange={setStrokeColor} />
            </PropertyRow>
            <PropertyRow label="Width">
              <PropertyNumberInput value={strokeWidth} onChange={setStrokeWidth} min={0} max={20} step={1} span={4} />
            </PropertyRow>
          </PropertiesPanel>
        )}

        <PropertiesPanel title="Colors">
          <PropertyRow>
            <PropertySwatchGrid
              value={primary ? primaryFill : fillColor}
              options={PALETTE}
              onChange={(v) => (primary ? applyFillToSelection(v) : setFillColor(v))}
            />
          </PropertyRow>
        </PropertiesPanel>

        <PropertiesPanel title="Document">
          <PropertyRow label="Title">
            <PropertyTextInput value={docTitle} onChange={setDocTitle} />
          </PropertyRow>
          <PropertyRow label="Paper">
            <PropertySelect
              value={paperSize}
              onChange={setPaperSize}
              options={[
                { value: 'letter', label: 'US Letter' },
                { value: 'a4', label: 'A4' },
                { value: 'legal', label: 'Legal' },
              ]}
            />
          </PropertyRow>
        </PropertiesPanel>

        <PropertiesPanel title="View">
          <PropertyRow label="Zoom">
            <PropertyMiniLabel span={2}>%</PropertyMiniLabel>
            <PropertyNumberInput
              value={Math.round(view.scale * 100)}
              onChange={(v) => setView((cur) => ({ ...cur, scale: Math.max(0.1, v / 100) }))}
              span={4}
              min={10}
              max={400}
              step={10}
            />
          </PropertyRow>
          <PropertyRow label="Grid">
            <PropertyNumberInput value={gridDensity} onChange={setGridDensity} span={4} min={2} max={64} step={1} />
          </PropertyRow>
          <PropertyRow>
            <PropertyButton onClick={() => setView({ x: 0, y: 0, scale: 1 })} span={12}>
              Reset view
            </PropertyButton>
          </PropertyRow>
        </PropertiesPanel>

        <div style={{ flex: 1 }} />
        <div className="swill-section-label" style={{ padding: '0 12px' }}>Scene</div>
        <div style={{ fontSize: 11, color: 'var(--wui-text-muted)', fontFamily: 'ui-monospace, monospace', padding: '0 12px' }}>
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
