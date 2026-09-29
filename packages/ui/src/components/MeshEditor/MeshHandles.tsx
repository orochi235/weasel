import { type ReactElement } from 'react';
import { asPaint, type FillStyle } from '@weasel-js/core';
import {
  meshGuides,
  meshHandles,
  moveMeshHandle,
  type MeshGradientFill,
  type MeshHandle,
} from '@weasel-js/core/mesh';
import { handleHalf } from '../../handles';
import {
  DragPoint,
  Edge,
  Guide,
  HandleOverlay,
  type EditPhase,
  type OverlayPoint as Point,
} from '../GradientEditor/handleOverlay';

/** Props for {@link MeshHandles}. `onInput` fires throughout a drag and
 *  `onChange` once at its end. */
export interface MeshHandlesProps {
  /** The mesh whose points these handles move, in the space `toScreen`
   *  maps from. A `units: 'bounds'` mesh is resolved first with
   *  `fillInPoseFrame(fill, box)`, and edits converted back with
   *  `fillToBoundsFrame(next, box)`. */
  value: MeshGradientFill;
  /** Mesh space → overlay pixels. */
  toScreen: (p: Point) => Point;
  /** Overlay pixels → mesh space. Must invert `toScreen`. */
  toLocal: (p: Point) => Point;
  /** Live during a drag — wire for preview, do not write to history. Emitted
   *  as a `FillStyle`, which is what every paint control passes around. */
  onInput?: (next: FillStyle) => void;
  /** Committed at drag end: one call per gesture. */
  onChange: (next: FillStyle) => void;
  /** Overlay size in CSS pixels. */
  width: number;
  height: number;
  className?: string;
}

const CORNER_RADIUS = handleHalf('--wzl-handle-size-lg');
const CONTROL_RADIUS = handleHalf('--wzl-handle-size');

/**
 * Direct-manipulation handles for a mesh gradient's geometry, drawn as an
 * SVG overlay: every patch corner, the two controls of each edge, and a
 * tensor patch's interior points, over the patch outlines they shape.
 *
 * Dragging a corner carries its controls with it. Points two patches share
 * are one handle, so a drag moves the seam instead of tearing it.
 *
 * The overlay ignores pointer events except on the handles themselves.
 */
export function MeshHandles(props: MeshHandlesProps): ReactElement {
  const { value, toScreen, toLocal, onInput, onChange, width, height, className } = props;
  const { edges, arms } = meshGuides(value);
  const handles = meshHandles(value);

  const emit = (handle: MeshHandle, p: Point, phase: EditPhase): void => {
    const next = asPaint(moveMeshHandle(value, handle, toLocal(p)));
    if (phase === 'input') onInput?.(next);
    else onChange(next);
  };

  // Corners last, so where a control collapses onto its corner the corner
  // is the one on top.
  const ordered = [
    ...handles.filter((h) => h.kind !== 'corner'),
    ...handles.filter((h) => h.kind === 'corner'),
  ];

  return (
    <HandleOverlay width={width} height={height} className={className}>
      {edges.map((edge, i) => (
        // Guides have no identity beyond their place in the walk.
        <Edge key={`e${i}`} points={[toScreen(edge[0]), toScreen(edge[1]), toScreen(edge[2]), toScreen(edge[3])]} />
      ))}
      {arms.map(([from, to], i) => {
        const a = toScreen(from);
        const b = toScreen(to);
        return <Guide key={`a${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
      {ordered.map((handle) => (
        <DragPoint
          key={handle.id}
          at={toScreen(handle.at)}
          label={labelOf(handle)}
          radius={handle.kind === 'corner' ? CORNER_RADIUS : CONTROL_RADIUS}
          variant={handle.kind === 'corner' ? 'handle' : 'control'}
          onDrag={(p, phase) => emit(handle, p, phase)}
        />
      ))}
    </HandleOverlay>
  );
}

/** Numbered in the patch's own walk, matching `MeshEditor`'s corner fields. */
function labelOf(handle: MeshHandle): string {
  const { patch, index } = handle.refs[0];
  const prefix = `Patch ${patch + 1}`;
  if (handle.kind === 'corner') return `${prefix} corner ${index / 3 + 1}`;
  if (handle.kind === 'interior') return `${prefix} interior ${index - 11}`;
  return `${prefix} edge ${Math.floor(index / 3) + 1} control ${index % 3}`;
}
