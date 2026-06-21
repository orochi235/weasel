import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useDragGesture,
  useDragRect,
  useDragRadial,
  useHandleDrag,
  useDragHandle,
  useDropZone,
  startThresholdDrag,
} from '@weasel-js/core';
import type { ModifierState, DragGesturePoint } from '@weasel-js/core';

/**
 * Gestures showcase — every gesture *form* in `src/interactions/gestures` on one
 * surface. Pick a mode; the canvas binds to that one gesture and draws a live
 * overlay so the differences between the drag variants are visible, not just
 * described. The point is to *feel* how each hook reports motion differently.
 */

const W = 520;
const H = 360;

// Fixed rect used by the local-space `useHandleDrag` mode.
const HX = 180, HY = 120, HW = 160, HH = 110;
// Movement thresholds (px) for the threshold-gated modes.
const TH = 18;        // startThresholdDrag dead-zone
const CLICK_TH = 8;   // useDragGesture click-vs-drag dead-zone

type ModeId = 'drag' | 'rect' | 'radial' | 'threshold' | 'handle' | 'drop' | 'click';

const MODES: { id: ModeId; label: string }[] = [
  { id: 'drag', label: 'drag' },
  { id: 'rect', label: 'drag-rect' },
  { id: 'radial', label: 'radial' },
  { id: 'threshold', label: 'threshold' },
  { id: 'click', label: 'click vs drag' },
  { id: 'handle', label: 'local-space' },
  { id: 'drop', label: 'drag + drop' },
];

const HINTS: Record<ModeId, string> = {
  drag: 'useDragGesture — press & drag to trace the pointer; reads world + client coords and phase.',
  rect: 'useDragRect — drag a marquee; the hook reports normalized bounds {x, y, width, height}.',
  radial: 'useDragRadial — drag out from the press point; the hook reports angle + radius, not x/y.',
  threshold: `startThresholdDrag — no move events fire until you cross the ${TH}px dead-zone (then it engages).`,
  click: `useDragGesture w/ thresholdReached — release inside ${CLICK_TH}px = click, past it = drag.`,
  handle: 'useHandleDrag — drag inside the rect; coords are local to that element, not the surface.',
  drop: 'useDragHandle + useDropZone — drag the chip; only the zone whose accepts() matches lights up.',
};

const fmt = (n: number) => Math.round(n).toString();

export function GesturesDemo() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<ModeId>('drag');
  const modeRef = useRef<ModeId>('drag');
  const [readout, setReadout] = useState(HINTS.drag);
  const [mods, setMods] = useState<ModifierState>({ alt: false, shift: false, meta: false, ctrl: false });

  // Overlay state lives in refs so draw() reads it without depending on the
  // controller instances (which change identity each render).
  const dragO = useRef<{ trace: { x: number; y: number }[]; start: { x: number; y: number } } | null>(null);
  const rectO = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const radialO = useRef<{ cx: number; cy: number; radius: number; rotation: number } | null>(null);
  const thO = useRef<{ x: number; y: number; cur: { x: number; y: number }; engaged: boolean } | null>(null);
  const clickO = useRef<{ sx: number; sy: number; cx: number; cy: number; active: boolean; result: string | null } | null>(null);
  const handleO = useRef<{ x: number; y: number } | null>(null);

  // ── drawing ──────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 2;
    const dot = (x: number, y: number, color: string, r = 4) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    switch (modeRef.current) {
      case 'drag': {
        const o = dragO.current;
        if (!o) break;
        ctx.strokeStyle = '#7fb069';
        ctx.beginPath();
        o.trace.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
        dot(o.start.x, o.start.y, '#4f6f43', 5);
        const cur = o.trace[o.trace.length - 1];
        if (cur) dot(cur.x, cur.y, '#7fb069');
        break;
      }
      case 'rect': {
        const b = rectO.current;
        if (!b) break;
        ctx.fillStyle = 'rgba(111,159,217,0.14)';
        ctx.fillRect(b.x, b.y, b.width, b.height);
        ctx.strokeStyle = '#6f9fd9';
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(b.x, b.y, b.width, b.height);
        ctx.setLineDash([]);
        break;
      }
      case 'radial': {
        const o = radialO.current;
        if (!o) break;
        const ex = o.cx + Math.cos(o.rotation) * o.radius;
        const ey = o.cy + Math.sin(o.rotation) * o.radius;
        ctx.strokeStyle = '#d98f6f';
        ctx.beginPath();
        ctx.moveTo(o.cx, o.cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(o.cx, o.cy, Math.min(o.radius, 44), 0, o.rotation, o.rotation < 0);
        ctx.stroke();
        dot(o.cx, o.cy, '#b5654a', 5);
        dot(ex, ey, '#d98f6f');
        break;
      }
      case 'threshold': {
        const o = thO.current;
        if (!o) break;
        const color = o.engaged ? '#7fb069' : '#caa15a';
        ctx.strokeStyle = color;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(o.x, o.y, TH, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        if (o.engaged) {
          ctx.beginPath();
          ctx.moveTo(o.x, o.y);
          ctx.lineTo(o.cur.x, o.cur.y);
          ctx.stroke();
          dot(o.cur.x, o.cur.y, color);
        }
        dot(o.x, o.y, '#7a6a3a', 5);
        break;
      }
      case 'click': {
        const o = clickO.current;
        if (!o) break;
        const color = o.result === 'CLICK' ? '#6f9fd9' : o.active ? '#7fb069' : '#caa15a';
        ctx.strokeStyle = color;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(o.sx, o.sy, CLICK_TH, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(o.sx, o.sy);
        ctx.lineTo(o.cx, o.cy);
        ctx.stroke();
        dot(o.sx, o.sy, color, 5);
        dot(o.cx, o.cy, color);
        if (o.result) {
          ctx.fillStyle = color;
          ctx.font = '13px ui-monospace, Menlo, monospace';
          ctx.fillText(o.result, o.cx + 8, o.cy - 8);
        }
        break;
      }
      case 'handle': {
        ctx.fillStyle = 'rgba(176,127,208,0.12)';
        ctx.fillRect(HX, HY, HW, HH);
        ctx.strokeStyle = '#b07fd0';
        ctx.strokeRect(HX, HY, HW, HH);
        const l = handleO.current;
        if (l) {
          const px = HX + l.x;
          const py = HY + l.y;
          ctx.strokeStyle = '#d0a7e8';
          ctx.beginPath();
          ctx.moveTo(px - 8, py);
          ctx.lineTo(px + 8, py);
          ctx.moveTo(px, py - 8);
          ctx.lineTo(px, py + 8);
          ctx.stroke();
        }
        break;
      }
      // 'drop' is rendered with DOM elements, not the canvas.
    }
  }, []);

  // ── coordinate helpers ─────────────────────────────────────────────────────
  const modsOf = (e: React.PointerEvent): ModifierState => ({
    alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey,
  });
  const ptOf = (e: React.PointerEvent): DragGesturePoint => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { clientX: e.clientX, clientY: e.clientY, worldX: e.clientX - r.left, worldY: e.clientY - r.top };
  };

  // ── controllers (drag / rect / radial / click) ─────────────────────────────
  const drag = useDragGesture({
    onStart: (c) => {
      dragO.current = { trace: [{ x: c.start.worldX, y: c.start.worldY }], start: { x: c.start.worldX, y: c.start.worldY } };
      draw();
    },
    onMove: (c) => {
      dragO.current?.trace.push({ x: c.current.worldX, y: c.current.worldY });
      setReadout(
        `phase ${c.phase} · world (${fmt(c.current.worldX)}, ${fmt(c.current.worldY)}) · ` +
        `client (${c.current.clientX}, ${c.current.clientY}) · ` +
        `Δ (${fmt(c.current.worldX - c.start.worldX)}, ${fmt(c.current.worldY - c.start.worldY)})`,
      );
      draw();
    },
  });

  const rect = useDragRect({
    onMove: (c) => {
      rectO.current = c.bounds;
      setReadout(`bounds x ${fmt(c.bounds.x)} · y ${fmt(c.bounds.y)} · w ${fmt(c.bounds.width)} · h ${fmt(c.bounds.height)}`);
      draw();
    },
    onEnd: () => { rectO.current = null; draw(); },
  });

  const radial = useDragRadial({
    onMove: (c) => {
      radialO.current = { cx: c.center.x, cy: c.center.y, radius: c.radius, rotation: c.rotation };
      const deg = ((c.rotation * 180) / Math.PI).toFixed(0);
      setReadout(`angle ${deg}° · radius ${fmt(c.radius)}px · center (${fmt(c.center.x)}, ${fmt(c.center.y)})`);
      draw();
    },
    onEnd: () => { radialO.current = null; draw(); },
  });

  const click = useDragGesture({
    thresholdReached: (c) =>
      Math.hypot(c.current.worldX - c.start.worldX, c.current.worldY - c.start.worldY) > CLICK_TH,
    onStart: (c) => {
      clickO.current = { sx: c.start.worldX, sy: c.start.worldY, cx: c.current.worldX, cy: c.current.worldY, active: false, result: null };
      setReadout(`phase pending · move past ${CLICK_TH}px to become a drag`);
      draw();
    },
    onActivate: () => { if (clickO.current) clickO.current.active = true; },
    onMove: (c) => {
      if (clickO.current) {
        clickO.current.cx = c.current.worldX;
        clickO.current.cy = c.current.worldY;
        clickO.current.active = c.phase === 'active';
      }
      setReadout(`phase ${c.phase} · moved ${fmt(Math.hypot(c.current.worldX - c.start.worldX, c.current.worldY - c.start.worldY))}px`);
      draw();
    },
    onEnd: (c) => {
      const result = c.wasSubThreshold ? 'CLICK' : 'DRAG';
      if (clickO.current) clickO.current.result = result;
      setReadout(`result: ${result} — sub-threshold release ${c.wasSubThreshold ? '✓' : '✗'} (threshold ${CLICK_TH}px)`);
      draw();
    },
  });

  // ── local-space handle (useHandleDrag) ──────────────────────────────────────
  const handle = useHandleDrag<HTMLDivElement>({
    onStart: (p) => { handleO.current = p; draw(); },
    onMove: (p) => {
      handleO.current = p;
      setReadout(`local (${fmt(p.x)}, ${fmt(p.y)}) inside the ${HW}×${HH} rect — origin is the rect's top-left`);
      draw();
    },
  });

  // ── drag-and-drop (useDragHandle + useDropZone) ─────────────────────────────
  const [overA, setOverA] = useState(false);
  const [overB, setOverB] = useState(false);
  const chip = useDragHandle(() => ({ kind: 'shape', ids: ['rect-a', 'rect-b'] }));
  const zoneA = useDropZone<HTMLDivElement>({
    accepts: (k) => k === 'shape',
    onOver: setOverA,
    onDrop: (p) => setReadout(`dropped kind "${p.kind}" ids [${p.ids.join(', ')}] → Zone A`),
  });
  const zoneB = useDropZone<HTMLDivElement>({
    accepts: (k) => k === 'image',
    onOver: setOverB,
    onDrop: (p) => setReadout(`dropped "${p.kind}" → Zone B`),
  });

  // ── pointer routing on the canvas ───────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setMods(modsOf(e));
    const m = modeRef.current;
    const p = ptOf(e);
    if (m === 'drag') { e.currentTarget.setPointerCapture(e.pointerId); drag.start(p, modsOf(e)); }
    else if (m === 'click') { e.currentTarget.setPointerCapture(e.pointerId); click.start(p, modsOf(e)); }
    else if (m === 'rect') { e.currentTarget.setPointerCapture(e.pointerId); rect.start(p.worldX, p.worldY, modsOf(e)); }
    else if (m === 'radial') { e.currentTarget.setPointerCapture(e.pointerId); radial.start(p.worldX, p.worldY, modsOf(e)); }
    else if (m === 'threshold') {
      const r = canvasRef.current!.getBoundingClientRect();
      const local = (cx: number, cy: number) => ({ x: cx - r.left, y: cy - r.top });
      thO.current = { ...local(e.clientX, e.clientY), cur: local(e.clientX, e.clientY), engaged: false };
      setReadout(`threshold ${TH}px · engaged ✗ — no move events until you cross the dead-zone`);
      draw();
      const sx = e.clientX, sy = e.clientY;
      startThresholdDrag(e, {
        threshold: TH,
        onActivate: () => { if (thO.current) thO.current.engaged = true; },
        onMove: (ev) => {
          if (thO.current) thO.current.cur = local(ev.clientX, ev.clientY);
          setReadout(`threshold ${TH}px · engaged ✓ · moved ${fmt(Math.hypot(ev.clientX - sx, ev.clientY - sy))}px`);
          draw();
        },
        onCommit: () => {},
      });
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setMods(modsOf(e));
    if (!(e.buttons & 1)) return;
    const m = modeRef.current;
    const p = ptOf(e);
    if (m === 'drag') drag.move(p, modsOf(e));
    else if (m === 'click') click.move(p, modsOf(e));
    else if (m === 'rect') rect.move(p.worldX, p.worldY, modsOf(e));
    else if (m === 'radial') radial.move(p.worldX, p.worldY, modsOf(e));
  };
  const onPointerUp = () => {
    const m = modeRef.current;
    if (m === 'drag') drag.end();
    else if (m === 'click') click.end();
    else if (m === 'rect') rect.end();
    else if (m === 'radial') radial.end();
  };

  const selectMode = (id: ModeId) => {
    modeRef.current = id;
    setMode(id);
    dragO.current = rectO.current = radialO.current = thO.current = clickO.current = handleO.current = null;
    setReadout(HINTS[id]);
    requestAnimationFrame(draw);
  };

  // Initial clear + live modifier readout (key events, not just pointer).
  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const upd = (e: KeyboardEvent) => setMods({ alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey });
    window.addEventListener('keydown', upd);
    window.addEventListener('keyup', upd);
    return () => { window.removeEventListener('keydown', upd); window.removeEventListener('keyup', upd); };
  }, []);

  return (
    <div className="ckd-gestures">
      <div className="ckd-gestures-modes" role="radiogroup" aria-label="Gesture">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            className={`ckd-gestures-mode${mode === m.id ? ' is-active' : ''}`}
            onClick={() => selectMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="ckd-gestures-surface">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="ckd-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
        {mode === 'handle' && (
          // Transparent hit-target overlaying the drawn rect; useHandleDrag
          // reports coords local to *this* element.
          <div className="ckd-gestures-hit" {...handle} />
        )}
        {mode === 'drop' && (
          <div className="ckd-gestures-dnd">
            <div className="ckd-gestures-chip" {...chip}>
              chip · kind: shape · ids: [rect-a, rect-b]
            </div>
            <div ref={zoneA} className={`ckd-gestures-zone${overA ? ' is-over' : ''}`}>
              Zone A — accepts: shape ✓
            </div>
            <div ref={zoneB} className={`ckd-gestures-zone${overB ? ' is-over' : ''}`}>
              Zone B — accepts: image ✗
            </div>
          </div>
        )}
      </div>

      <div className="ckd-gestures-readout">{readout}</div>

      <div className="ckd-gestures-mods" aria-label="Live modifier state">
        {(['shift', 'alt', 'meta', 'ctrl'] as const).map((k) => (
          <span key={k} className={`ckd-gestures-mod${mods[k] ? ' is-on' : ''}`}>{k}</span>
        ))}
      </div>
    </div>
  );
}
