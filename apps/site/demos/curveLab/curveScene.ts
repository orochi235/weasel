import { solid } from '@weasel-js/paint';
import { asNodeId, IDENTITY_POSE_COMPOSITION, type NodeId, type Scene, type Stroke, type UseSceneOptions } from '@weasel-js/core';
import {
  bezierCubic,
  bezierQuadratic,
  nurbs,
  spiro,
  type CurveRepresentation,
  type SharedAnchor,
} from '@weasel-js/geom/curves';
import { CURVE_PRESETS, type CurvePreset } from './presets';

export const REPS = [bezierCubic, bezierQuadratic, nurbs, spiro] as const;

export type CurveKind = (typeof REPS)[number]['kind'];
export type CurvePose = ReturnType<CurveRepresentation['toPath']>;
export interface CurveData {
  rep: CurveKind;
  stroke: Stroke;
}

const CURVE_STROKE: Stroke = { paint: solid('#7fb069'), width: 2 };
/** One scene for every panel: each representation's curve on a layer of its own, the anchors they share in its
 *  document, so one history holds them all. */
export type CurveScene = Scene<CurveData, CurveKind, CurvePose>;

const ANCHORS = 'curveLab:anchors';
const PRESET = 'curveLab:preset';

export const curveIdOf = (rep: CurveRepresentation): NodeId => asNodeId(`curve-${rep.kind}`);

/** The scene layer `rep`'s curve sits on, as a canvas's `layerVisibility` names it. */
export const renderLayerOf = (kind: CurveKind) => `scene:${kind}`;

export const anchorsOf = (scene: CurveScene): SharedAnchor[] => scene.doc.get<SharedAnchor[]>(ANCHORS) ?? [];
export const presetIdOf = (scene: CurveScene): string => scene.doc.get<string>(PRESET) ?? CURVE_PRESETS[0].id;

export function curveSceneOptions(): UseSceneOptions<CurveData, CurveKind, CurvePose> {
  const { id, anchors } = CURVE_PRESETS[0];
  return {
    composition: IDENTITY_POSE_COMPOSITION,
    systemLayers: REPS.map((rep) => ({ id: rep.kind })),
    initial: REPS.map((rep) => ({
      id: curveIdOf(rep),
      kind: 'mark' as const,
      layer: rep.kind,
      pose: rep.toPath(anchors),
      data: { rep: rep.kind, stroke: CURVE_STROKE },
    })),
    doc: { [ANCHORS]: anchors, [PRESET]: id },
  };
}

/** Write `anchors` and every curve drawn from them, as one edit. */
export function setAnchors(scene: CurveScene, anchors: SharedAnchor[], label = 'Move anchor'): void {
  scene.batch(label, () => {
    scene.doc.set(ANCHORS, anchors);
    for (const rep of REPS) scene.setPose(curveIdOf(rep), rep.toPath(anchors));
  });
}

export function applyPreset(scene: CurveScene, preset: CurvePreset): void {
  scene.batch('Preset', () => {
    scene.doc.set(PRESET, preset.id);
    setAnchors(scene, preset.anchors.map((a) => ({ ...a })));
  });
}
