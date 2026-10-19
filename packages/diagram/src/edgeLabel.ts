/**
 * Edge labels: the one place a label node's spec is made, and the action that
 * adds or edits an edge's label on a double-click.
 */
import {
  ActionDisabledReason,
  bodyPredicate,
  type Action,
  type ActionDeps,
  type AddNodeSpec,
  type GestureBinding,
  type InvocationCtx,
  type RectPose,
} from '@weasel-js/core';
import type { MeasureRowText, RowTextStyle } from './body';
import { diagramEdgeOf } from './edgeTrait';
import { LABEL_DERIVE_POSE } from './label';
import { LABEL_PLACEMENT, type DiagramLabel } from './labelTrait';

/** The face an edge label is set in: the diagram's, two sizes down. */
export const labelStyleOf = (font: { fontFamily: string; fontSize: number }) => ({ ...font, fontSize: font.fontSize - 2 });

const LABEL_STYLE: RowTextStyle = labelStyleOf({ fontFamily: 'sans-serif', fontSize: 12 });
const LABEL_FILL = '#dbe7f2';
const GLYPH = 0.6;

export interface EdgeLabelOptions<TLayer extends string> {
  layer: TLayer;
  /** Where along the edge it sits. Default {@link LABEL_PLACEMENT}. */
  label?: DiagramLabel;
  style?: RowTextStyle;
  /** Text color. */
  fill?: string;
  /** Sizes the box. Default: a per-character estimate. */
  measure?: MeasureRowText;
}

/** The label node for edge `edgeId`: a leaf that derives its pose from the edge's route. */
export function edgeLabelSpec<TLayer extends string>(
  edgeId: string, text: string, opts: EdgeLabelOptions<TLayer>,
): AddNodeSpec<unknown, TLayer, RectPose> {
  const style = opts.style ?? LABEL_STYLE;
  const size = style.fontSize ?? 10;
  const width = opts.measure !== undefined ? opts.measure(text, style).width : text.length * size * GLYPH;
  return {
    id: `${edgeId}/label` as never,
    kind: 'leaf',
    layer: opts.layer,
    pickable: false,
    pose: { x: 0, y: 0, width, height: size },
    data: {
      diagram: { label: opts.label ?? LABEL_PLACEMENT },
      text,
      style,
      fill: { paint: { color: opts.fill ?? LABEL_FILL } },
    },
    dependsOn: [edgeId as never],
    derivePose: LABEL_DERIVE_POSE as never,
  } as AddNodeSpec<unknown, TLayer, RectPose>;
}

export const EDIT_EDGE_LABEL_ACTION_ID = 'diagram.editEdgeLabel';

export interface EditEdgeLabelOptions {
  /** Runs in place of the default add-then-edit. */
  commit?: (edgeId: string, ctx: InvocationCtx) => void;
}

function edgeUnder(deps: ActionDeps | undefined, at: { x: number; y: number } | undefined): string | null {
  if (deps === undefined || at === undefined) return null;
  const id = deps.nodeAtPoint?.(at);
  const node = id == null ? undefined : deps.scene.get(id);
  return node !== undefined && diagramEdgeOf(node) !== null ? id! : null;
}

function beginEditing(edgeId: string, ctx: InvocationCtx): void {
  const { scene, textEdit } = ctx.deps;
  const labelId = `${edgeId}/label`;
  if (scene.get(labelId as never) === undefined) {
    const edge = scene.get(edgeId as never);
    if (edge === undefined) return;
    scene.add(edgeLabelSpec(edgeId, '', { layer: edge.layer }) as never);
  }
  textEdit?.startEdit(labelId);
}

/**
 * Creates an edge's label, or edits the one it has, where a double-click
 * lands on the edge. It declines a double-click on anything else.
 *
 * An immediate invoker is handed no `InvocationCtx`, so `commit` gets one
 * built from the deps and the click point.
 */
export function editEdgeLabelAction(opts: EditEdgeLabelOptions = {}): Action {
  const commit = opts.commit ?? beginEditing;
  return {
    id: EDIT_EDGE_LABEL_ACTION_ID,
    label: 'Edit edge label',
    group: 'diagram',
    eligible: { mode: { in: ['normal', 'isolation'] } },
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const world = { x: Number(params?.worldX), y: Number(params?.worldY) };
        const edgeId = edgeUnder(deps, world);
        if (edgeId === null) return;
        const ctx = { world, modifiers: { alt: false, shift: false, meta: false, ctrl: false }, deps } as InvocationCtx;
        commit(edgeId, ctx);
      },
    },
    enabled: (deps, at) => (edgeUnder(deps, at) !== null ? true : ActionDisabledReason.NotApplicable),
  };
}

const onBody = bodyPredicate((target) => target === 'selected-body' || target === 'unselected-body');

/** A double-click on a node's body; the action itself declines unless that node is an edge. */
export function editEdgeLabelBinding(actionId: string = EDIT_EDGE_LABEL_ACTION_ID): GestureBinding {
  return { spec: { kind: 'doubleClick', target: { kindOf: onBody } }, actionId };
}
