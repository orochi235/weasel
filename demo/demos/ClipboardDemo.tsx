import { useMemo, useRef, useState } from 'react';
import {
  arrayAdapter,
  asNodeId,
  Canvas,
  useClipboard,
  useSelection,
  useSelectTool,
  useTools,
} from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 480, H = 320;

const INITIAL: Rect[] = [
  { id: 'a', x: 40,  y: 60,  width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 160, y: 130, width: 80, height: 60, color: '#d4a574' },
  { id: 'c', x: 280, y: 60,  width: 80, height: 60, color: '#8aa6c1' },
];

export function ClipboardDemo() {
  const [items, setItems] = useState<Rect[]>(INITIAL);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const nextId = useRef(0);
  const dropPointRef = useRef<{ worldX: number; worldY: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selection = useSelection();

  const adapter = useMemo(() => {
    // arrayAdapter's default `commitPaste` deep-clones each clip entry,
    // assigns a fresh id via `nextId`, and translates by `offset` — or
    // centers the cluster bbox at `ctx.dropPoint` when supplied. The demo
    // only overrides `nextId` to keep deterministic `clip-N` ids and
    // `getPasteOffset` to bump from 1px to 16px so the cascade is visible.
    const base = arrayAdapter<Rect, Rect>({
      ref: itemsRef,
      setItems,
      toPose: (r) => r,
      nextId: () => `clip-${nextId.current++}`,
    });
    return {
      ...base,
      ...selection.adapterMethods,
      getNodeIndex: (id: string) => itemsRef.current.findIndex((o) => o.id === id),
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
