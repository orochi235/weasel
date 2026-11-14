import {
  ActionsProvider, ActiveToolContextProvider, DepRegistryProvider, type Tool, useAction, useActionsRegistry,
  useGestureDispatcher, type WorldPoint,
} from '@weasel-js/core';
import { invert, transformPoint } from '@weasel-js/geom';
import { useLatest } from '@weasel-js/react';
import { type RefObject, useMemo, useRef, useState } from 'react';
import { type SplineEditorInput, splineEditorActions } from './splineActions';
import type { SplineAnchor, SplineMode } from './splineAnchors';
import { maxAngle, polarPoint, sampleCurve } from './splineGeometry';
import s from './OctantSplineEditor.module.css';

const RINGS = [10, 20, 30, 40, 50, 60, 70];
const RAY_LENGTH = 75;

const NO_TOOLS: ReadonlyMap<string, Tool> = new Map();
const CHANNELS = { pointer: true, wheel: true, contextMenu: true, hover: false, pinch: false, ingest: false, carry: false } as const;

/** A client point in the editor's view box, which is the world its actions read. */
function toViewBox(svg: SVGSVGElement | null, clientX: number, clientY: number): WorldPoint {
  const ctm = svg?.getScreenCTM();
  const inverse = ctm && invert([ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f]);
  if (!inverse) return { x: Number.NaN, y: Number.NaN };
  const [x, y] = transformPoint(inverse, clientX, clientY);
  return { x, y };
}

function Dispatch({ hostRef, svgRef, input }: {
  hostRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  input: { readonly current: SplineEditorInput };
}) {
  const registry = useActionsRegistry();
  const [move, insert, remove, weigh] = useMemo(() => splineEditorActions(input), [input]);
  useAction(move!);
  useAction(insert!);
  useAction(remove!);
  useAction(weigh!);
  useGestureDispatcher({
    canvasRef: hostRef,
    actions: registry!,
    entriesById: NO_TOOLS,
    keyboard: false,
    hears: 'own',
    channels: CHANNELS,
    clientToWorld: (x, y) => toViewBox(svgRef.current, x, y),
  });
  return null;
}

/** Mounts the editor's own dispatcher, its actions in a registry of their own. Renders nothing. */
function SplineEditorInputs(props: Parameters<typeof Dispatch>[0]) {
  return (
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Dispatch {...props} />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
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

function AnchorDot({ anchor, at, pinned, active }: { anchor: SplineAnchor; at: { x: number; y: number }; pinned: boolean; active: boolean }) {
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
      />
      <text x={at.x + 2.5} y={at.y - 1.5} fontSize="2.8" className={s.anchorLabel}>
        {`(${anchor.s.toFixed(2)}, ${anchor.r.toFixed(1)}) w${anchor.w.toFixed(1)}`}
      </text>
    </g>
  );
}

/** One octant (or quadrant) of a spline base, drawn in polar form with its anchors as dots its actions edit. */
export function OctantSplineEditor({ anchors, mode, evalAtS, onAnchorDraft, onAnchorChange, onAnchorDelete, onAnchorAdd }: {
  anchors: SplineAnchor[];
  mode: SplineMode;
  evalAtS: (s: number) => number;
  /** An anchor as a drag passes through it. */
  onAnchorDraft: (idx: number, next: SplineAnchor) => void;
  /** An anchor settled: a drag's end, or a weight change. */
  onAnchorChange: (idx: number, next: SplineAnchor) => void;
  onAnchorDelete: (idx: number) => void;
  onAnchorAdd: (s: number, r: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const samples = sampleCurve(mode, evalAtS);
  const input = useLatest<SplineEditorInput>({
    mode, anchors, samples, setActive,
    draft: onAnchorDraft, commit: onAnchorChange, remove: onAnchorDelete, insert: onAnchorAdd,
  });
  const last = anchors.length - 1;
  return (
    <div className={s.editor}>
      <SplineEditorInputs hostRef={hostRef} svgRef={svgRef} input={input} />
      <div ref={hostRef} className={s.host}>
        <svg
          ref={svgRef}
          viewBox={mode === 'octant' ? '-8 -80 90 90' : '-8 -82 90 92'}
          className={s.canvas}
          data-dragging={active !== null || undefined}
        >
          <Grid mode={mode} />
          <polyline
            points={samples.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}
            className={s.curve}
            strokeWidth="0.7"
            vectorEffect="non-scaling-stroke"
          />
          {anchors.map((anchor, idx) => (
            <AnchorDot
              key={idx}
              anchor={anchor}
              at={polarPoint(mode, anchor.s, anchor.r)}
              pinned={idx === 0 || idx === last}
              active={active === idx}
            />
          ))}
        </svg>
      </div>
      <p className={s.help}>
        <strong>Drag</strong> a dot to move it. <strong>Shift-drag</strong> locks it to the curve's normal, so it slides
        toward or away from the curve without moving along it. <strong>Scroll</strong> over a dot to change its weight,
        which its size follows. <strong>Right-click</strong> an interior dot to delete it. <strong>Alt-click</strong> to
        insert an anchor. The end anchors (cream) stay on the cardinal and diagonal axes.
      </p>
    </div>
  );
}
