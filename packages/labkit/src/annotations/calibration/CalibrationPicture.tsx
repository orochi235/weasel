import type { ReactNode } from 'react';
import { type CalibrationConfig, pictureSize, zoomWindow } from './condition';
import { CONTENT, EXERCISES, type Exercise } from './exercises';

// Literal colors rather than theme tokens: the picture is paper that an export copies as markup, with no
// stylesheet to resolve a token against, and the marks over it are drawn in fixed colors too.
const PAPER = '#ffffff';
const GUIDE = '#9aa0a8';
const LABEL = '#4b5058';
const CELL_LINE = '#e6e8eb';

/** A guide's own stroke: the color it asks for, else the faint guide gray. */
const ink = (ex: Exercise): string => ex.color ?? GUIDE;

const guideLine = (ex: Exercise) =>
  ({
    fill: 'none',
    stroke: ink(ex),
    strokeWidth: ex.width ?? 1.5,
    strokeOpacity: ex.width === undefined ? 0.8 : 0.3,
    strokeDasharray: ex.width === undefined ? '4 3' : undefined,
  }) as const;

function Endpoint({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <>
      <circle cx={x} cy={y} r={3} fill={LABEL} />
      <text x={x + 6} y={y - 6} fontSize={11} fill={LABEL}>
        {label}
      </text>
    </>
  );
}

function BoxGuide({ ex }: { ex: Exercise }) {
  if (ex.guide.kind !== 'box') return null;
  const { x, y, w, h } = ex.guide.box;
  if (ex.expect === 'ellipse') {
    return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...guideLine(ex)} />;
  }
  return (
    <>
      <rect x={x} y={y} width={w} height={h} {...guideLine(ex)} />
      {ex.expect === 'text' ? <circle cx={x} cy={y} r={3} fill={LABEL} /> : null}
    </>
  );
}

function Guide({ ex }: { ex: Exercise }): ReactNode {
  const g = ex.guide;
  if (g.kind === 'box') return <BoxGuide ex={ex} />;
  if (g.kind === 'curve') {
    return <polyline points={g.points.map((p) => `${p.x},${p.y}`).join(' ')} {...guideLine(ex)} />;
  }
  return (
    <>
      <line x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} {...guideLine(ex)} />
      {ex.expect === 'arrow' ? (
        <>
          <Endpoint x={g.a.x} y={g.a.y} label="A" />
          <Endpoint x={g.b.x} y={g.b.y} label="B" />
        </>
      ) : null}
    </>
  );
}

/** The coloring book: every exercise's instruction over its faint guide, drawn at the condition's scale and zoom. */
export function CalibrationPicture({ config }: { config: CalibrationConfig }) {
  const size = pictureSize(config);
  const win = zoomWindow(config);
  return (
    <svg
      className="lk-cal__svg"
      width={size.w}
      height={size.h}
      viewBox={`${win.x} ${win.y} ${win.w} ${win.h}`}
      role="img"
      aria-label="Calibration exercises"
    >
      <title>Calibration exercises</title>
      <rect x={0} y={0} width={CONTENT.w} height={CONTENT.h} fill={PAPER} />
      {EXERCISES.map((ex) => (
        <g key={ex.id} data-exercise={ex.id}>
          <rect
            x={ex.area.x + 0.5}
            y={ex.area.y + 0.5}
            width={ex.area.w - 1}
            height={ex.area.h - 1}
            fill="none"
            stroke={CELL_LINE}
          />
          <text x={ex.area.x + 8} y={ex.area.y + 16} fontSize={11} fill={LABEL}>
            {ex.instruction}
          </text>
          <Guide ex={ex} />
        </g>
      ))}
    </svg>
  );
}
