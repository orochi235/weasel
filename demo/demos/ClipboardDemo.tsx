import { useMemo, useRef } from 'react';
import {
  arrayAdapter,
  asNodeId,
  Canvas,
  useClipboard,
  useSelection,
  useSelectTool,
  useTools,
} from '@orochi235/weasel';
import type { ClipboardSnapshot } from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 480, H = 320;

const INITIAL: Rect[] = [
  { id: 'a', x: 40,  y: 60,  width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 160, y: 130, width: 80, height: 60, color: '#d4a574' },
  { id: 'c', x: 280, y: 60,  width: 80, height: 60, color: '#8aa6c1' },
];

export function ClipboardDemo() {
  const itemsRef = useRef<Rect[]>(INITIAL);
  const nextId = useRef(0);
  const dropPointRef = useRef<{ worldX: number; worldY: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selection = useSelection();

  const adapter = useMemo(() => {
    const base = arrayAdapter<Rect, Rect>({
      ref: itemsRef,
      setItems: (update) => {
        itemsRef.current = typeof update === 'function' ? update(itemsRef.current) : update;
      },
      toPose: (r) => r,
    });
    return {
      ...base,
      ...selection.adapterMethods,
      snapshotSelection: (ids: string[]): ClipboardSnapshot => ({
        items: ids
          .map((id) => itemsRef.current.find((o) => o.id === id))
          .filter((o): o is Rect => !!o),
      }),
      commitPaste: (
        clip: ClipboardSnapshot,
        offset: { dx: number; dy: number },
        ctx?: { dropPoint?: { worldX: number; worldY: number } },
      ): Rect[] => {
        const src = clip.items as Rect[];
        if (src.length === 0) return [];
        let dx = offset.dx;
        let dy = offset.dy;
        if (ctx?.dropPoint) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const r of src) {
            minX = Math.min(minX, r.x);
            minY = Math.min(minY, r.y);
            maxX = Math.max(maxX, r.x + r.width);
            maxY = Math.max(maxY, r.y + r.height);
          }
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          dx = ctx.dropPoint.worldX - cx;
          dy = ctx.dropPoint.worldY - cy;
        }
        return src.map((r) => ({
          ...r,
          id: `clip-${nextId.current++}`,
          x: r.x + dx,
          y: r.y + dy,
        }));
      },
      getPasteOffset: () => ({ dx: 16, dy: 16 }),
    };
  }, [selection.adapterMethods]);

  useClipboard(adapter, {
    getSelection: () => selection.current.map((id) => asNodeId(id)),
    getDropPoint: () => dropPointRef.current,
  });

  const select = useSelectTool(adapter, {
    pickEvery: (wx, wy) => {
      const hits: string[] = [];
      for (const r of itemsRef.current) {
        if (wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height) {
          hits.push(r.id);
        }
      }
      return hits;
    },
  });
  const tools = useTools({ active: 'select', registry: { select } });

  const onMouseMove = (e: React.MouseEvent) => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dropPointRef.current = {
      worldX: e.clientX - rect.left,
      worldY: e.clientY - rect.top,
    };
  };
  const onMouseLeave = () => { dropPointRef.current = null; };

  return (
    <div ref={wrapperRef} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
      <Canvas
        width={W}
        height={H}
        className="ckd-canvas"
        adapter={adapter}
        selection={selection}
        tools={tools}
        layers={{
          scene: {
            drawOne: (r: Rect, p: Rect): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: r.color },
            }],
          },
        }}
      />
    </div>
  );
}
