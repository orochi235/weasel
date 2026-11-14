import { type ControlRenderer, valueAtPath } from '@weasel-js/labkit';
import type { BadgeBase } from '@weasel-js/ui/components/Badge';
import { OCTANT_SPLINE_MAX_ANCHORS, OCTANT_SPLINE_MIN_ANCHORS } from '@weasel-js/ui/components/Badge/geometry';
import { PropertyField } from '@weasel-js/ui/components/Properties';
import type { SplineCurve } from '../baseParams';
import type { Params } from '../params';
import { OctantSplineEditor } from './OctantSplineEditor';
import {
  anchorCount, readAnchors, splineEvaluator, splineMode, withAnchor, withAnchorCount, withInsertedAnchor, withoutAnchor,
} from './splineAnchors';

type RowContext = Parameters<ControlRenderer>[0];

/** The curve leaf of a spline base's group: the base is the group's key, the mode its sibling. */
function SplineRow({ path, value, values, setValue, disabled }: RowContext) {
  const group = path.slice(0, path.lastIndexOf('.'));
  const base = group.slice(group.lastIndexOf('.') + 1) as BadgeBase;
  const curve = value as SplineCurve;
  const mode = splineMode((valueAtPath(values, group) ?? {}) as Params);
  // The anchor helpers read the mode beside the slots, as the base does.
  const bag: Params = { ...curve, mode };
  const write = (next: Params) => {
    const { mode: _mode, ...slots } = next;
    setValue(slots);
  };
  const anchors = readAnchors(bag);
  return (
    <>
      <PropertyField
        kind="number"
        control="slider"
        label="Anchors"
        value={anchorCount(bag)}
        min={OCTANT_SPLINE_MIN_ANCHORS}
        max={OCTANT_SPLINE_MAX_ANCHORS}
        step={1}
        disabled={disabled}
        onChange={(count) => write(withAnchorCount(bag, count))}
      />
      <OctantSplineEditor
        anchors={anchors}
        mode={mode}
        evalAtS={splineEvaluator(base, anchors)}
        onAnchorChange={(idx, next) => write(withAnchor(bag, idx, next))}
        onAnchorDelete={(idx) => write(withoutAnchor(bag, idx))}
        onAnchorAdd={(s, r) => write(withInsertedAnchor(bag, s, r))}
      />
    </>
  );
}

/** Draws a spline base's anchors as a curve editor, with the anchor count above it. */
export const splineRenderer: ControlRenderer = Object.assign((ctx: RowContext) => <SplineRow {...ctx} />, { wide: true });
