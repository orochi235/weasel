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
  type Scene,
} from '@weasel-js/core';
import type { MeasureRowText, RowTextStyle } from './body';
import { diagramEdgeOf } from './edgeTrait';
import { LABEL_DERIVE_POSE } from './label';
import { labelScratchOf, labelUnder } from './labelDragLayer';
import { LABEL_PLACEMENT, diagramLabelOf, type DiagramLabel } from './labelTrait';

/** The face an edge label is set in: the diagram's, two sizes down. */
export const labelStyleOf = (font: { fontFamily: string; fontSize: number }) => ({ ...font, fontSize: font.fontSize - 2 });

/** The diagram's face when the scene names none. */
export const DEFAULT_FONT = { fontFamily: 'sans-serif', fontSize: 12 };
/** Advance width per character, in font sizes, where nothing measures text. */
export const GLYPH = 0.6;

const LABEL_STYLE: RowTextStyle = labelStyleOf(DEFAULT_FONT);
const LABEL_FILL = '#dbe7f2';

/** The box a label's text takes: measured width, and a height of the font size
 *  whatever the measure reports. */
export function labelSize(text: string, style: RowTextStyle, measure?: MeasureRowText): { width: number; height: number } {
  const size = style.fontSize ?? LABEL_STYLE.fontSize!;
  return { width: measure !== undefined ? measure(text, style).width : text.length * size * GLYPH, height: size };
}

/** Options for {@link edgeLabelSpec}. */
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
  return {
    id: `${edgeId}/label` as never,
    kind: 'leaf',
    layer: opts.layer,
    pickable: false,
    pose: { x: 0, y: 0, ...labelSize(text, style, opts.measure) },
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

/**
 * Removes node `id` if it is an edge label left with no text, and says whether
 * it did. The default edit adds a label before its text is typed, so a host
 * passes this as its text edit's `onEnd` to drop one that ends empty.
 */
export function dropEmptyEdgeLabel(scene: Scene<unknown, string, unknown>, id: string): boolean {
  const node = scene.get(id as never);
  if (node === undefined || diagramLabelOf(node) === null) return false;
  const text = (node.data as { text?: unknown }).text;
  if (typeof text === 'string' && text.trim() !== '') return false;
  scene.remove(id as never);
  return true;
}

/** The action that adds or edits an edge's label. */
export const EDIT_EDGE_LABEL_ACTION_ID = 'diagram.editEdgeLabel';

/** Options for {@link editEdgeLabelAction}. */
export interface EditEdgeLabelOptions {
  /** Runs in place of the default add-then-edit. */
  commit?: (edgeId: string, ctx: InvocationCtx) => void;
  /** The face a new label is set in. Default the diagram's, two sizes down. Ignored when `commit` is given. */
  style?: RowTextStyle;
  /** A new label's text color. Ignored when `commit` is given. */
  fill?: string;
}

function edgeUnder(deps: ActionDeps | undefined, at: { x: number; y: number } | undefined): string | null {
  if (deps === undefined || at === undefined) return null;
  // A label is not pickable, so a connector passing under it would win the pick.
  const label = deps.scene === undefined ? null : labelUnder(deps.scene, at);
  if (label !== null) return label.edgeId;
  const id = deps.nodeAtPoint?.(at);
  const node = id == null ? undefined : deps.scene?.get(id);
  return node !== undefined && diagramEdgeOf(node) !== null ? id! : null;
}

function beginEditing(edgeId: string, ctx: InvocationCtx, look: Pick<EditEdgeLabelOptions, 'style' | 'fill'>): void {
  const { scene, textEdit } = ctx.deps;
  if (scene === undefined) return;
  const labelId = `${edgeId}/label`;
  if (scene.get(labelId as never) === undefined) {
    const edge = scene.get(edgeId as never);
    if (edge === undefined) return;
    scene.add(edgeLabelSpec(edgeId, '', {
      layer: edge.layer,
      ...(look.style ? { style: look.style } : {}),
      ...(look.fill !== undefined ? { fill: look.fill } : {}),
    }) as never);
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
  const commit = opts.commit ?? ((edgeId: string, ctx: InvocationCtx) => beginEditing(edgeId, ctx, opts));
  return {
    id: EDIT_EDGE_LABEL_ACTION_ID,
    label: 'Edit edge label',
    group: 'diagram',
    requires: ['scene', 'nodeAtPoint', 'textEdit'],
    eligible: { mode: { in: ['normal', 'isolation'] } },
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const world = { x: Number(params?.worldX), y: Number(params?.worldY) };
        const pressed = labelScratchOf((params as { affordance?: { payload?: unknown } } | undefined)?.affordance);
        const edgeId = pressed?.edgeId ?? edgeUnder(deps, world);
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
  return { spec: { kind: 'doubleClick', target: { kindOf: onBody } }, actionId, opts: { id: `${actionId}.doubleClick` } };
}
