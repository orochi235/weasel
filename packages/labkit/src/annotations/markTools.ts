import { type FeaturePreset, type InsertNodeFactory, useLatest } from '@weasel-js/core';
import {
  editPreset,
  KIT_TOOL_IDS,
  type KitToolId,
  movePreset,
  pickPreset,
  shapeToolsOfferedPreset,
  transformPreset,
} from '@weasel-js/editing';
import { usePencilTool } from '@weasel-js/path-tools';
import type { ToolOptionValues } from '@weasel-js/routing';
import { createTextTool, textPreset } from '@weasel-js/text-tools';
import { boundsOf, roundPoints, toShape, type WorldRect } from './frac';
import { markStyleFrom } from './options';
import { seenValues } from './staleness';
import { ANNOTATION_WEASEL_TOOLS, annotationToolInfo, annotationToolOptions } from './toolMap';
import type { AnnotationData, AnnotationKind, AnnotationTarget, FracPoint } from './types';
import { useLabToolOptionValues } from './useLabToolOptions';

/** Every vertex the insert carried, in world units. */
function verticesOf(extras: Record<string, unknown>): readonly FracPoint[] | undefined {
  if (extras.kind === 'line') return [extras.a as FracPoint, extras.b as FracPoint];
  if (extras.kind === 'pencil') {
    const samples = extras.samples as FracPoint[];
    return samples.length > 0 ? samples : undefined;
  }
  return undefined;
}

/** The pose and shape an insert's vertices make: the box that holds them, and
 *  the vertices stored against that very box. Undefined for an insert that
 *  carries no vertices, whose drag bounds are the whole geometry. */
export function insertedGeometry(
  extras: Record<string, unknown>,
): { pose: WorldRect; shape: readonly FracPoint[] } | undefined {
  const vertices = verticesOf(extras);
  if (!vertices) return undefined;
  const box = boundsOf(vertices);
  if (!box) return undefined;
  return {
    pose: box,
    shape: roundPoints(toShape(vertices, box)),
  };
}

/** The text tool, from text-tools; the pencil is mounted from path-tools, and editing's shape tools by id. */
const ANNOTATION_TEXT: FeaturePreset = {
  id: 'annotations:text',
  tools: [createTextTool()],
  includes: [textPreset],
};
const FEATURES = [
  pickPreset,
  movePreset,
  transformPreset,
  editPreset,
  shapeToolsOfferedPreset,
  ANNOTATION_TEXT,
];
const BUILTIN_ANNOTATION_TOOLS = ANNOTATION_WEASEL_TOOLS.filter((t): t is KitToolId =>
  (KIT_TOOL_IDS as readonly string[]).includes(t),
);

/** One factory per weasel tool, each making the mark the rail's tool means. */
function insertFactories(
  target: AnnotationTarget,
  toolRef: { readonly current: string | null },
  configRef: { readonly current: unknown },
  values: ToolOptionValues,
): Record<string, InsertNodeFactory> {
  const id = target.id;
  const factories: Record<string, InsertNodeFactory> = {};
  for (const weaselTool of ANNOTATION_WEASEL_TOOLS) {
    factories[weaselTool] = (_bounds, extras) => {
      const info = annotationToolInfo(toolRef.current);
      const kind: AnnotationKind | undefined = info?.kind;
      if (!kind) return null;
      const seen = seenValues(configRef.current, target.positionDependsOn ?? []);
      const tool = toolRef.current ?? '';
      const style = markStyleFrom(tool, annotationToolOptions(tool), values);
      const geometry = insertedGeometry(extras as unknown as Record<string, unknown>);
      if (!geometry) return { data: { target: id, kind, ...style, seen } satisfies AnnotationData };
      const data: AnnotationData = { target: id, kind, shape: geometry.shape, ...style, seen };
      return { data, pose: geometry.pose };
    };
  }
  return factories;
}

/** What the pane's canvas mounts to make marks: the features, the weasel tools the rail's tools drive, and an
 *  insert factory for each that reads the tool the pane holds now. */
export function useMarkTools(
  target: AnnotationTarget,
  activeToolId: string | null,
  config: unknown,
) {
  // Read in the insert factory, which is built once and must see the tool the
  // pane is holding now — `arrow` and `stroke` are indistinguishable from
  // `line` and `pencil` at the weasel end.
  const toolRef = useLatest(activeToolId);
  const configRef = useLatest(config);
  const optionValues = useLabToolOptionValues();
  const pencil = usePencilTool();
  return {
    features: FEATURES,
    defaultTools: BUILTIN_ANNOTATION_TOOLS,
    tools: { pencil },
    insertNodeFactories: insertFactories(target, toolRef, configRef, optionValues),
  };
}
