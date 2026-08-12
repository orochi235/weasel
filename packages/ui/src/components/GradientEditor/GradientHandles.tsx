import { useRef, type ReactElement, type ReactNode } from 'react';
import { useHandleDrag, gradientGeometry, type GradientFill } from '@weasel-js/core';
import s from './GradientHandles.module.css';

/** Structural, and deliberately not exported — `Plot2D` and `CurveEditor`
 *  each publish their own `Point`, and a third would only be ambiguous at
 *  the package barrel. Consumers pass any `{ x, y }`. */
interface Point {
  x: number;
  y: number;
}

export interface GradientHandlesProps {
  /**
   * The gradient whose geometry these handles move, in a **resolved,
   * isotropic** frame — one where `radius` is a length in the same units as
   * `center.x` and a right angle is a right angle.
   *
   * A `units: 'bounds'` gradient is not such a frame: `x` and `y` are
   * fractions of two different lengths, so a circle there is an ellipse on
   * screen and polar math silently mixes scales. Resolve it first with
   * `fillInPoseFrame(fill, box)` and convert edits back with
   * `fillToBoundsFrame(next, box)`.
   */
  value: GradientFill;
  /**
   * Gradient space → overlay pixels. For a `units: 'local'` gradient this
   * is the node's local-to-screen transform; for `'world'`, the view.
   */
  toScreen: (p: Point) => Point;
  /** Overlay pixels → gradient space. Must invert `toScreen`. */
  toLocal: (p: Point) => Point;
  /** Live during a drag — wire for preview, do not write to history. */
  onInput?: (next: GradientFill) => void;
  /** Committed at drag end: one call per gesture. */
  onChange: (next: GradientFill) => void;
  /** Overlay size in CSS pixels. */
  width: number;
  height: number;
  className?: string;
}

/**
 * Direct-manipulation handles for a gradient's geometry, drawn as an SVG
 * overlay above a canvas: endpoints for linear, center and radius for
 * radial, center and angle arm for conic.
 *
 * Positioning is entirely the consumer's `toScreen` / `toLocal` — this
 * component never sees a view or a scene node, so the same handles serve a
 * node-local gradient, a world-space one, and a plain unzoomed preview.
 *
 * The overlay ignores pointer events except on the handles themselves, so
 * it can sit over live canvas content without swallowing tool input.
 */
export function GradientHandles(props: GradientHandlesProps): ReactElement {
  const { value, toScreen, toLocal, onInput, onChange, width, height, className } = props;

  return (
    <svg
      className={[s.overlay, className].filter(Boolean).join(' ')}
      width={width}
      height={height}
    >
      {renderForKind(value, toScreen, toLocal, onInput, onChange)}
    </svg>
  );
}

function renderForKind(
  value: GradientFill,
  toScreen: (p: Point) => Point,
  toLocal: (p: Point) => Point,
  onInput: ((next: GradientFill) => void) | undefined,
  onChange: (next: GradientFill) => void,
): ReactNode {
  const emit = (next: GradientFill, phase: 'input' | 'commit'): void => {
    if (phase === 'input') onInput?.(next);
    else onChange(next);
  };

  if (value.fill === 'linear-gradient') {
    const from = toScreen(value.from);
    const to = toScreen(value.to);
    return (
      <>
        <Guide x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
        <DragPoint
          at={from}
          label="Gradient start"
          onDrag={(p, phase) => emit({ ...value, from: toLocal(p) }, phase)}
        />
        <DragPoint
          at={to}
          label="Gradient end"
          onDrag={(p, phase) => emit({ ...value, to: toLocal(p) }, phase)}
        />
      </>
    );
  }

  if (value.fill === 'radial-gradient') {
    const center = toScreen(value.center);
    // The radius handle rides the +x axis of gradient space, so it stays on
    // the drawn circle under a rotated or anisotropic transform.
    const edge = toScreen({ x: value.center.x + value.radius, y: value.center.y });
    const screenRadius = Math.hypot(edge.x - center.x, edge.y - center.y);
    return (
      <>
        <circle className={s.guide} cx={center.x} cy={center.y} r={screenRadius} />
        <DragPoint
          at={center}
          label="Gradient center"
          onDrag={(p, phase) => emit({ ...value, center: toLocal(p) }, phase)}
        />
        <DragPoint
          at={edge}
          label="Gradient radius"
          onDrag={(p, phase) => {
            const local = toLocal(p);
            const radius = Math.hypot(local.x - value.center.x, local.y - value.center.y);
            emit({ ...value, radius: Math.max(MIN_RADIUS, radius) }, phase);
          }}
        />
      </>
    );
  }

  const center = toScreen(value.center);
  const { radius } = gradientGeometry(value);
  const tip = toScreen({
    x: value.center.x + Math.cos(value.angle) * radius,
    y: value.center.y + Math.sin(value.angle) * radius,
  });
  return (
    <>
      <Guide x1={center.x} y1={center.y} x2={tip.x} y2={tip.y} />
      <DragPoint
        at={center}
        label="Gradient center"
        onDrag={(p, phase) => emit({ ...value, center: toLocal(p) }, phase)}
      />
      <DragPoint
        at={tip}
        label="Gradient angle"
        onDrag={(p, phase) => {
          const local = toLocal(p);
          const angle = Math.atan2(local.y - value.center.y, local.x - value.center.x);
          emit({ ...value, angle }, phase);
        }}
      />
    </>
  );
}

/** A radius of zero divides by zero in the shader's `t`; keep it off the floor. */
const MIN_RADIUS = 1;

function Guide(props: { x1: number; y1: number; x2: number; y2: number }): ReactElement {
  return <line className={s.guide} {...props} />;
}

function DragPoint({
  at,
  label,
  onDrag,
}: {
  at: Point;
  label: string;
  onDrag: (p: Point, phase: 'input' | 'commit') => void;
}): ReactElement {
  // `useHandleDrag` reports the pointer on move but not on end, so the last
  // position is held here to commit with — otherwise releasing the pointer
  // would write whatever the gradient held before the drag began.
  const last = useRef<Point>(at);
  const drag = useHandleDrag<SVGCircleElement>({
    onMove: (p) => {
      last.current = p;
      onDrag(p, 'input');
    },
    onEnd: () => onDrag(last.current, 'commit'),
  });
  return (
    <circle
      className={s.handle}
      cx={at.x}
      cy={at.y}
      r={HANDLE_RADIUS}
      role="slider"
      aria-label={label}
      tabIndex={0}
      {...drag}
    />
  );
}

const HANDLE_RADIUS = 7;
