import { type ReactElement, type ReactNode } from 'react';
import { gradientGeometry, type GradientPaint } from '@weasel-js/paint';
import { DragPoint, Guide, HandleOverlay, useOverlayEdit, type EditPhase, type OverlayPoint as Point } from './handleOverlay';
import s from './handleOverlay.module.css';
import { useTints } from '@weasel-js/theme/react';
import { handleHalf } from '../../handles';

/**
 * Props for {@link GradientHandles}. `onInput`, `onChange` and `onCancel` are the kit's edit protocol
 * (`docs/conventions.md`, "Edit callbacks"): a drag or an arrow-key step is one edit, and Escape cancels a drag.
 */
export interface GradientHandlesProps {
  /**
   * The gradient whose geometry these handles move, in a **resolved,
   * isotropic** frame — one where `radius` is a length in the same units as
   * `center.x` and a right angle is a right angle.
   *
   * A `units: 'bounds'` gradient is not such a frame: `x` and `y` are
   * fractions of two different lengths, so a circle there is an ellipse on
   * screen and polar math silently mixes scales. Resolve it first with
   * `paintToLocalUnits(fill, box)` and convert edits back with
   * `paintToBoundsUnits(next, box)`.
   */
  value: GradientPaint;
  /**
   * Gradient space → overlay pixels. For a `units: 'local'` gradient this
   * is the node's local-to-screen transform; for `'world'`, the view.
   */
  toScreen: (p: Point) => Point;
  /** Overlay pixels → gradient space. Must invert `toScreen`. */
  toLocal: (p: Point) => Point;
  onInput?: (next: GradientPaint) => void;
  onChange: (next: GradientPaint) => void;
  onCancel?: () => void;
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
 * Positioning is entirely the consumer's `toScreen` / `toLocal`, so the same
 * handles serve a node-local gradient, a world-space one, and a plain
 * unzoomed preview.
 *
 * The overlay ignores pointer events except on the handles themselves, so
 * it can sit over live canvas content without swallowing tool input.
 */
export function GradientHandles(props: GradientHandlesProps): ReactElement {
  const { toScreen, toLocal, width, height, className } = props;
  const { shown: value, emit, session } = useOverlayEdit(props.value, props);
  const handleRadius = handleHalf('--wzl-handle-size-lg', useTints().resolved);

  return (
    <HandleOverlay width={width} height={height} className={className} session={session}>
      {renderForKind(value, toScreen, toLocal, emit, handleRadius)}
    </HandleOverlay>
  );
}

function renderForKind(
  value: GradientPaint,
  toScreen: (p: Point) => Point,
  toLocal: (p: Point) => Point,
  emit: (next: GradientPaint, phase: EditPhase) => void,
  handleRadius: number,
): ReactNode {
  if (value.kind === 'linear-gradient') {
    const from = toScreen(value.from);
    const to = toScreen(value.to);
    return (
      <>
        <Guide x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
        <DragPoint
          radius={handleRadius}
          at={from}
          label="Gradient start"
          onDrag={(p, phase) => emit({ ...value, from: toLocal(p) }, phase)}
        />
        <DragPoint
          radius={handleRadius}
          at={to}
          label="Gradient end"
          onDrag={(p, phase) => emit({ ...value, to: toLocal(p) }, phase)}
        />
      </>
    );
  }

  if (value.kind === 'radial-gradient') {
    const center = toScreen(value.center);
    const edge = toScreen({ x: value.center.x + value.radius, y: value.center.y });
    // One overlay pixel, so the floor holds whatever the gradient's units are.
    const floor = distance(toLocal({ x: center.x + 1, y: center.y }), toLocal(center));
    return (
      <>
        <circle className={s.guide} cx={center.x} cy={center.y} r={distance(center, edge)} />
        <DragPoint
          radius={handleRadius}
          at={center}
          label="Gradient center"
          onDrag={(p, phase) => emit({ ...value, center: toLocal(p) }, phase)}
        />
        <DragPoint
          radius={handleRadius}
          at={edge}
          label="Gradient radius"
          axis={unit(center, edge)}
          onDrag={(p, phase) => {
            emit({ ...value, radius: Math.max(floor, distance(toLocal(p), value.center)) }, phase);
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
  const turn = toScreen({ x: value.center.x - Math.sin(value.angle), y: value.center.y + Math.cos(value.angle) });
  return (
    <>
      <Guide x1={center.x} y1={center.y} x2={tip.x} y2={tip.y} />
      <DragPoint
        radius={handleRadius}
        at={center}
        label="Gradient center"
        onDrag={(p, phase) => emit({ ...value, center: toLocal(p) }, phase)}
      />
      <DragPoint
        radius={handleRadius}
        at={tip}
        label="Gradient angle"
        axis={unit(center, turn)}
        onDrag={(p, phase) => {
          const local = toLocal(p);
          const angle = Math.atan2(local.y - value.center.y, local.x - value.center.x);
          emit({ ...value, angle }, phase);
        }}
      />
    </>
  );
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The unit direction from `a` to `b`, or +x where they meet. */
function unit(a: Point, b: Point): Point {
  const d = distance(a, b);
  return d > 0 ? { x: (b.x - a.x) / d, y: (b.y - a.y) / d } : { x: 1, y: 0 };
}

