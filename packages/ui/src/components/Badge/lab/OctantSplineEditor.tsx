import { useEffect, useRef, useState, type RefObject } from 'react';
import { useLatest } from '@weasel-js/core';
import { applyToPoint, invert } from '@weasel-js/geom';
import { OCTANT_SPLINE_MAX_ANCHORS } from '../bases/OctantSpline';
import type { SplineAnchor, SplineMode } from './splineAnchors';
import {
  dragEnd, dragInterior, insertionAt, maxAngle, normalAxisAt, polarPoint, projectOntoAxis, sampleCurve, wheelWeight,
  type Axis, type Point,
} from './splineGeometry';
import s from './OctantSplineEditor.stories.module.css';

const RINGS = [10, 20, 30, 40, 50, 60, 70];
const RAY_LENGTH = 75;

type SvgRef = RefObject<SVGSVGElement | null>;
type OnAnchorChange = (idx: number, next: SplineAnchor) => void;

function toViewBox(svg: SVGSVGElement | null, clientX: number, clientY: number): Point | null {
  const ctm = svg?.getScreenCTM();
  const inverse = ctm && invert([ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f]);
  if (!inverse) return null;
  const [x, y] = applyToPoint(inverse, clientX, clientY);
  return { x, y };
}

/**
 * A pressed anchor follows the mouse until release. An end anchor slides along
 * its ray; an interior one moves freely, or along `axis` when the press gave one.
 */
function useAnchorDrag(svgRef: SvgRef, mode: SplineMode, anchors: SplineAnchor[], onAnchorChange: OnAnchorChange) {
  const [drag, setDrag] = useState<{ idx: number; axis: Axis | null } | null>(null);
  const latest = useLatest({ mode, anchors, onAnchorChange });
  useEffect(() => {
    if (!drag) return;
    const onMouseMove = (e: MouseEvent) => {
      const local = toViewBox(svgRef.current, e.clientX, e.clientY);
      if (!local) return;
      const now = latest.current;
      const last = now.anchors.length - 1;
      if (drag.idx === 0 || drag.idx === last) {
        const end = drag.idx === 0 ? 'first' : 'last';
        now.onAnchorChange(drag.idx, dragEnd(now.mode, end, local, now.anchors[drag.idx].w));
        return;
      }
      const point = drag.axis ? projectOntoAxis(drag.axis, local) : local;
      now.onAnchorChange(drag.idx, dragInterior(now.mode, now.anchors, drag.idx, point));
    };
    const onMouseUp = () => setDrag(null);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [drag, latest, svgRef]);
  return { dragIdx: drag?.idx ?? null, startDrag: (idx: number, axis: Axis | null) => setDrag({ idx, axis }) };
}

function Grid({ mode }: { mode: SplineMode }) {
  const end = maxAngle(mode);
  const endX = RAY_LENGTH * Math.cos(end);
  const endY = -RAY_LENGTH * Math.sin(end);
  return (
    <>
      {RINGS.map((r) => (
        <path
          key={r}
          d={`M ${r} 0 A ${r} ${r} 0 0 0 ${(r * Math.cos(end)).toFixed(2)} ${(-r * Math.sin(end)).toFixed(2)}`}
          fill="none"
          className={s.ring}
          strokeWidth="0.3"
        />
      ))}
      <line x1="0" y1="0" x2={RAY_LENGTH} y2="0" className={s.ray} strokeWidth="0.4" strokeDasharray="1.5 1.5" />
      <line x1="0" y1="0" x2={endX.toFixed(2)} y2={endY.toFixed(2)} className={s.ray} strokeWidth="0.4" strokeDasharray="1.5 1.5" />
      <text x="76" y="2" fontSize="3" className={s.rayLabel}>cardinal (s = 0)</text>
      <text x={(endX + 2).toFixed(2)} y={(endY - 1).toFixed(2)} fontSize="3" className={s.rayLabel}>
        {mode === 'octant' ? 'diagonal (s = 1)' : 'next cardinal (s = 1)'}
      </text>
    </>
  );
}

function AnchorDot({ anchor, at, pinned, active, onPress, onDelete, onWeight }: {
  anchor: SplineAnchor;
  at: Point;
  pinned: boolean;
  active: boolean;
  onPress: (shift: boolean) => void;
  onDelete: () => void;
  onWeight: (w: number) => void;
}) {
  return (
    <g>
      <line x1="0" y1="0" x2={at.x.toFixed(2)} y2={at.y.toFixed(2)} className={s.spoke} strokeWidth="0.25" />
      <circle
        className={s.dot}
        data-pinned={pinned || undefined}
        data-active={active || undefined}
        cx={at.x}
        cy={at.y}
        r={active ? 2.6 : 1.5 + anchor.w * 0.7}
        strokeWidth="0.7"
        onMouseDown={(e) => {
          e.preventDefault();
          onPress(e.shiftKey);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onDelete();
        }}
        onWheel={(e) => {
          e.preventDefault();
          onWeight(wheelWeight(anchor.w, e.deltaY));
        }}
      />
      <text x={at.x + 2.5} y={at.y - 1.5} fontSize="2.8" className={s.anchorLabel}>
        {`(${anchor.s.toFixed(2)}, ${anchor.r.toFixed(1)}) w${anchor.w.toFixed(1)}`}
      </text>
    </g>
  );
}

/** One octant (or quadrant) of a spline base, drawn in polar form with its anchors as draggable dots. */
export function OctantSplineEditor({ anchors, mode, evalAtS, onAnchorChange, onAnchorDelete, onAnchorAdd }: {
  anchors: SplineAnchor[];
  mode: SplineMode;
  evalAtS: (s: number) => number;
  onAnchorChange: OnAnchorChange;
  onAnchorDelete: (idx: number) => void;
  onAnchorAdd: (s: number, r: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { dragIdx, startDrag } = useAnchorDrag(svgRef, mode, anchors, onAnchorChange);
  const samples = sampleCurve(mode, evalAtS);
  const last = anchors.length - 1;
  return (
    <div className={s.editor}>
      <svg
        ref={svgRef}
        viewBox={mode === 'octant' ? '-8 -80 90 90' : '-8 -82 90 92'}
        className={s.canvas}
        data-dragging={dragIdx !== null || undefined}
        onClick={(e) => {
          if (!e.altKey || anchors.length >= OCTANT_SPLINE_MAX_ANCHORS) return;
          const local = toViewBox(svgRef.current, e.clientX, e.clientY);
          if (!local) return;
          const at = insertionAt(mode, local);
          onAnchorAdd(at.s, at.r);
        }}
      >
        <Grid mode={mode} />
        <polyline
          points={samples.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}
          className={s.curve}
          strokeWidth="0.7"
          vectorEffect="non-scaling-stroke"
        />
        {anchors.map((anchor, idx) => {
          const at = polarPoint(mode, anchor.s, anchor.r);
          const pinned = idx === 0 || idx === last;
          return (
            <AnchorDot
              key={idx}
              anchor={anchor}
              at={at}
              pinned={pinned}
              active={dragIdx === idx}
              onPress={(shift) => startDrag(idx, shift && !pinned ? normalAxisAt(samples, at) : null)}
              onDelete={() => {
                if (!pinned && anchors.length > 3) onAnchorDelete(idx);
              }}
              onWeight={(w) => onAnchorChange(idx, { s: anchor.s, r: anchor.r, w })}
            />
          );
        })}
      </svg>
      <p className={s.help}>
        <strong>Drag</strong> a dot to move it freely. <strong>Shift-drag</strong> locks motion to the curve's local normal axis (slides the anchor toward/away from the curve without changing its tangential position). <strong>Scroll</strong> over a dot to change its weight (visual size scales with weight). <strong>Right-click</strong> an interior dot to delete it. <strong>Alt-click</strong> anywhere on the canvas to insert a new anchor. Endpoint anchors (cream) are pinned to the cardinal / diagonal axes.
      </p>
    </div>
  );
}
