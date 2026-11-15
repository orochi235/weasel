/**
 * A node a consumer painter draws (`registerNodeShape`), written as the draw
 * commands that painter returns. The commands are in the pose's own frame,
 * which the canvas turns with the pose's rotation and `transform`, so they go
 * in a `<g>` carrying that frame.
 */
import {
  findNodeShape,
  poseFrameOf,
  type DrawCommand,
  type GroupDrawCommand,
  type InheritedPaint,
  type NodeShapeEntry,
  type NodeShapes,
  type Paint,
  type PathDrawCommand,
  type Stroke,
} from '@weasel-js/core';
import { identity, invert, mat3, multiply, type Affine } from '@weasel-js/geom';
import type { SvgKitInherited } from './kitInherits';
import { svgPaintFromKit, svgStrokeFromKit, type SvgKitPose } from './kitPaint';
import { fillThroughMatrix } from './paintThroughMatrix';
import type { SvgGroupNode, SvgNode, SvgPaint, SvgPathNode } from './types';

/** Says `message` once for `key`. */
export type PainterWarn = (key: string, message: string) => void;

interface PaintedNode { kind: string; data: unknown; pose: SvgKitPose }

/**
 * `node` as its painter draws it, when that painter is not one of the kit's
 * own (`kit:`), which `svgLeafFromKit` writes from the data instead.
 * `undefined` for those and for a node no painter claims; `null` when the
 * painter draws nothing SVG can hold.
 */
export function painterLeafFromKit(
  node: PaintedNode, inherited: SvgKitInherited, warn: PainterWarn, shapes?: NodeShapes,
): SvgNode | null | undefined {
  const painter = findNodeShape(node as never, shapes);
  if (!painter || painter.id.startsWith('kit:')) return undefined;
  return svgFromPainter(painter as NodeShapeEntry, node, node.pose, inherited, warn);
}

/** What `painter` draws for `node` at `pose`, as `SvgNode`s; `null` for nothing SVG can hold. */
export function svgFromPainter(
  painter: NodeShapeEntry, node: unknown, pose: SvgKitPose, inherited: SvgKitInherited, warn: PainterWarn,
): SvgNode | null {
  const cmds = painter.paint(node as never, pose, { inherited: inherited as InheritedPaint });
  const frame = poseFrameOf(pose);
  const children = lowerCommands(cmds, frame ?? identity(), pose, painter.id, warn);
  if (children.length === 0) return null;
  if (frame) return { kind: 'group', transform: frame, children };
  return children.length === 1 ? children[0]! : { kind: 'group', children };
}

/** `cmds` as `SvgNode`s in the frame they were emitted in. `toDoc` takes that
 *  frame to the document's, where a `'world'` paint already is. */
function lowerCommands(
  cmds: readonly DrawCommand[], toDoc: Affine, pose: SvgKitPose, painter: string, warn: PainterWarn,
): SvgNode[] {
  const out: SvgNode[] = [];
  for (const cmd of cmds) {
    if (cmd.kind === 'path') out.push(lowerPath(cmd, toDoc, pose, painter, warn));
    else if (cmd.kind === 'group') {
      const g = lowerGroup(cmd, toDoc, pose, painter, warn);
      if (g) out.push(g);
    } else {
      warn(`command:${cmd.kind}`, `a ${cmd.kind} draw command from painter ${painter} has no SVG lowering and is left out`);
    }
  }
  return out;
}

function lowerPath(cmd: PathDrawCommand, toDoc: Affine, pose: SvgKitPose, painter: string, warn: PainterWarn): SvgPathNode {
  if (cmd.vertexColors) {
    warn('vertexColors', `per-anchor vertex colors from painter ${painter} are not written; the path takes its fill`);
  }
  const node: SvgPathNode = { kind: 'path', path: cmd.path, fill: paintIn(cmd.fill?.paint as Paint | undefined, toDoc, pose, warn) };
  const stroke = svgStrokeFromKit(cmd.stroke as Stroke | undefined, pose);
  if (stroke) node.stroke = { ...stroke, paint: paintIn(cmd.stroke!.paint as Paint | undefined, toDoc, pose, warn) };
  return node;
}

function lowerGroup(cmd: GroupDrawCommand, toDoc: Affine, pose: SvgKitPose, painter: string, warn: PainterWarn): SvgGroupNode | null {
  if (cmd.effects?.length) warn('effects', `group effects from painter ${painter} are not written; its children are, unfiltered`);
  if (cmd.colorMatrix) warn('colorMatrix', `a group color matrix from painter ${painter} is not written`);
  if (cmd.composite && cmd.composite !== 'source-over') {
    warn('composite', `a group composite operator from painter ${painter} is not written; its children draw source-over`);
  }
  const transform = cmd.transform ? mat3.toAffine(cmd.transform) : null;
  const children = lowerCommands(cmd.children, transform ? multiply(toDoc, transform) : toDoc, pose, painter, warn);
  if (children.length === 0) return null;
  return {
    kind: 'group',
    children,
    ...(transform ? { transform } : {}),
    ...(cmd.alpha !== undefined && cmd.alpha !== 1 ? { opacity: cmd.alpha } : {}),
    ...(cmd.clip ? { clip: cmd.clip } : {}),
  };
}

/**
 * A command's paint as an `SvgPaint` in the frame its path is written in. A
 * `'local'` gradient is in that frame already. A `'world'` one is in the
 * document's, so it is taken back through `toDoc`; so is a `'screen'` one,
 * which a document has no screen for and reads as at an unmoved view.
 */
function paintIn(paint: Paint | undefined, toDoc: Affine, pose: SvgKitPose, warn: PainterWarn): SvgPaint {
  const out = svgPaintFromKit(paint ?? null, pose);
  if (out.kind !== 'gradient' || !GRADIENTS.has(out.paint.kind as string)) return out;
  const units = (out.paint as { units?: string }).units;
  if (units === 'local') return out;
  const back = invert(toDoc);
  if (!back || isIdentity(back)) return out;
  const mapped = fillThroughMatrix({ ...out.paint, units: 'world' } as Paint, back, (m) => warn(`gradient:${m}`, m));
  if (units === undefined) delete (mapped as { units?: string }).units;
  else (mapped as { units?: string }).units = units;
  return { kind: 'gradient', paint: mapped };
}

const GRADIENTS = new Set(['linear-gradient', 'radial-gradient', 'conic-gradient']);

function isIdentity(m: Affine): boolean {
  return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;
}

const saidOnConsole = new Set<string>();

/** A {@link PainterWarn} saying each key once per call to `onWarn`, or, without
 *  one, once ever with `console.warn`. */
export function warnOncePerCall(onWarn: ((message: string) => void) | undefined): PainterWarn {
  const said = new Set<string>();
  return (key, message) => {
    if (onWarn) {
      if (!said.has(key)) onWarn(message);
      said.add(key);
    } else if (!saidOnConsole.has(key)) {
      saidOnConsole.add(key);
      console.warn(`@weasel-js/svg: ${message}`);
    }
  };
}
