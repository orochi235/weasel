import type { BadgeBase } from '@weasel-js/ui/components/Badge';
import { BASE_LAB_CONTROLS } from './controls';
import { OctantSplineEditor } from './OctantSplineEditor';
import { Field, LabToggle, ParamControl } from './ParamControl';
import type { LabParams } from './snapshot';
import {
  readAnchors, splineEvaluator, splineMode, withAnchor, withAnchorCount, withInsertedAnchor, withoutAnchor,
  type SplineMode,
} from './splineAnchors';
import controls from './controls.stories.module.css';

type Update = (update: (params: LabParams) => LabParams) => void;

const MODES: readonly SplineMode[] = ['octant', 'quadrant'];

/** A spline base's controls: the curve editor in place of per-anchor sliders, and a count that respaces the anchors. */
function SplineParams({ base, params, onChange }: { base: BadgeBase; params: LabParams; onChange: Update }) {
  const anchors = readAnchors(params);
  const mode = splineMode(params);
  return (
    <>
      <Field label="mode" columns={controls.wide2}>
        <LabToggle value={mode} options={MODES} onChange={(next) => onChange((p) => ({ ...p, mode: next }))} />
      </Field>
      <OctantSplineEditor
        anchors={anchors}
        mode={mode}
        evalAtS={splineEvaluator(base, anchors)}
        onAnchorChange={(idx, next) => onChange((p) => withAnchor(p, idx, next))}
        onAnchorDelete={(idx) => onChange((p) => withoutAnchor(p, idx))}
        onAnchorAdd={(s, r) => onChange((p) => withInsertedAnchor(p, s, r))}
      />
      {BASE_LAB_CONTROLS[base].filter((c) => c.key !== 'mode').map((c) => (
        c.key === 'count' && c.kind !== 'header' ? (
          <ParamControl key={c.key} control={c} value={params[c.key] ?? c.default} onChange={(v) => onChange((p) => withAnchorCount(p, Number(v)))} />
        ) : (
          <ParamControl key={c.key} control={c} value={params[c.key]} onChange={(v) => onChange((p) => ({ ...p, [c.key]: v }))} />
        )
      ))}
    </>
  );
}

/** The controls for the chosen base's params. */
export function BaseParams({ base, params, onChange }: { base: BadgeBase; params: LabParams; onChange: Update }) {
  if (base === 'octant-spline' || base === 'octant-bspline') return <SplineParams base={base} params={params} onChange={onChange} />;
  return (
    <>
      {BASE_LAB_CONTROLS[base].map((c) => (
        <ParamControl key={c.key} control={c} value={params[c.key]} onChange={(v) => onChange((p) => ({ ...p, [c.key]: v }))} />
      ))}
    </>
  );
}
