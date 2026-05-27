/**
 * Shape-kind extractor.
 *
 * Reads `src/canvas/SceneCanvas/useBuiltinShapeTools.tsx` and produces a
 * `ShapeSchema` per member of `KIT_SHAPE_KINDS`. Each kit shape is created
 * via `makeLeaf(idCall, poseLiteral, dataLiteral)`. We find the `const <id> =`
 * binding that synthesizes the tool and walk its initializer for the first
 * `makeLeaf(...)` call; the second and third arguments yield the pose and
 * data property lists respectively.
 *
 * The pose/data literals are not always plain object literals (pencil uses
 * helper `boundsOfPath`, pen wraps the bounds in a carrier, polygon/star are
 * synthesized inside `useInsertDepSource`). In those cases we fall back to
 * walking the closest object literal we can find in the initializer, and tag
 * the schema with a short note so consumers know why the picture is partial.
 */
import {
  Node,
  type Project,
  SyntaxKind,
  type ObjectLiteralExpression,
  type CallExpression,
  type VariableDeclaration,
} from 'ts-morph';
import { resolve } from 'node:path';
import type { PropertyDescriptor, ShapeSchema } from '../src/dev/traitSchemas.types';
import { srcRef, sourceFileOrThrow, readJsDoc } from './extract';

const SOURCE = 'src/canvas/SceneCanvas/useBuiltinShapeTools.tsx';

/** Map from binding identifier inside the hook to public shape-kind id. They
 *  happen to match for every kind except `pen` (whose binding destructures
 *  `tool: pen` from `usePenTool({...})`); the explicit map insulates us from
 *  future renames. */
const BINDING_TO_KIND: Record<string, string> = {
  rect: 'rect',
  ellipse: 'ellipse',
  line: 'line',
  polygon: 'polygon',
  star: 'star',
  pencil: 'pencil',
  pen: 'pen',
  lasso: 'lasso',
  text: 'text',
};

export function extractShapes(project: Project, repoRoot: string): Record<string, ShapeSchema> {
  const sf = sourceFileOrThrow(project, resolve(repoRoot, SOURCE));
  const out: Record<string, ShapeSchema> = {};

  for (const [binding, kindId] of Object.entries(BINDING_TO_KIND)) {
    const decl = findBinding(sf, binding);
    if (!decl) continue;
    const initializer = decl.getInitializer();
    if (!initializer) continue;

    const makeLeafCall = findMakeLeafCall(initializer);
    const objLiterals = collectObjectLiterals(initializer);

    let pose: readonly PropertyDescriptor[] = [];
    let data: readonly PropertyDescriptor[] = [];
    let notes: string | undefined;

    if (makeLeafCall) {
      const args = makeLeafCall.getArguments();
      const poseArg = args[1];
      const dataArg = args[2];
      pose = poseArg ? propertiesOf(poseArg) : [];
      data = dataArg ? propertiesOf(dataArg) : [];
    } else if (objLiterals.length > 0) {
      // Best-effort: pick the first object literal as 'data'. The pose is
      // synthesized elsewhere (insert-dep) and not visible here.
      data = propertiesOf(objLiterals[0]!);
      notes = `pose is synthesized outside this hook (likely via useInsertDepSource)`;
    } else {
      notes = `no createable literal found — selection-only or fully delegated`;
    }

    out[kindId] = {
      id: kindId,
      pose,
      data,
      renderer: pose.length > 0 || data.length > 0 ? 'PATH_PAINTER' : undefined,
      source: srcRef(decl, repoRoot),
      ...(notes ? { notes } : {}),
    };
  }

  return out;
}

function findBinding(sf: ReturnType<Project['getSourceFile']>, name: string): VariableDeclaration | null {
  if (!sf) return null;
  // Shape-tool bindings live inside `useBuiltinShapeTools`'s function body,
  // not at the source-file top level, so we have to walk descendants.
  let found: VariableDeclaration | null = null;
  sf.forEachDescendant((node, traverse) => {
    if (found) { traverse.stop(); return; }
    if (node.getKind() !== SyntaxKind.VariableDeclaration) return;
    const d = node as VariableDeclaration;
    if (d.getName() === name) { found = d; traverse.stop(); return; }
    const nameNode = d.getNameNode();
    if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
      const hit = nameNode.getDescendantsOfKind(SyntaxKind.BindingElement)
        .find((el) => el.getName() === name);
      if (hit) { found = d; traverse.stop(); }
    }
  });
  return found;
}

function findMakeLeafCall(node: Node): CallExpression | null {
  let found: CallExpression | null = null;
  node.forEachDescendant((n, traverse) => {
    if (found) { traverse.stop(); return; }
    if (n.getKind() !== SyntaxKind.CallExpression) return;
    const call = n as CallExpression;
    const expr = call.getExpression();
    if (expr.getText() === 'makeLeaf') { found = call; traverse.stop(); }
  });
  return found;
}

function collectObjectLiterals(node: Node): readonly ObjectLiteralExpression[] {
  const out: ObjectLiteralExpression[] = [];
  node.forEachDescendant((n) => {
    if (n.getKind() === SyntaxKind.ObjectLiteralExpression) {
      out.push(n as ObjectLiteralExpression);
    }
  });
  return out;
}

function propertiesOf(arg: Node): readonly PropertyDescriptor[] {
  // Unwrap parenthesized / `as` expressions.
  let n: Node = arg;
  while (
    n.getKind() === SyntaxKind.ParenthesizedExpression
    || n.getKind() === SyntaxKind.AsExpression
    || n.getKind() === SyntaxKind.TypeAssertionExpression
  ) {
    n = (n as unknown as { getExpression: () => Node }).getExpression();
  }
  if (n.getKind() !== SyntaxKind.ObjectLiteralExpression) return [];
  const obj = n as ObjectLiteralExpression;
  const out: PropertyDescriptor[] = [];
  for (const prop of obj.getProperties()) {
    if (prop.getKind() === SyntaxKind.PropertyAssignment) {
      const pa = prop as unknown as { getName: () => string; getInitializer: () => Node | undefined };
      const init = pa.getInitializer();
      let typeStr = 'unknown';
      let lit: string | undefined;
      if (init) {
        try { typeStr = init.getType().getText(init); } catch { typeStr = init.getText(); }
        if (init.getText().length < 80) lit = init.getText();
      }
      out.push({
        name: pa.getName(),
        type: clipType(typeStr),
        optional: false,
        ...(lit !== undefined ? { defaultLiteral: lit } : {}),
        ...(readJsDoc(prop) ? { doc: readJsDoc(prop) } : {}),
      });
    } else if (prop.getKind() === SyntaxKind.ShorthandPropertyAssignment) {
      const sa = prop as unknown as { getName: () => string };
      out.push({ name: sa.getName(), type: 'unknown', optional: false });
    }
  }
  return out;
}

function clipType(t: string): string {
  if (t.length <= 120) return t;
  return `${t.slice(0, 117)}...`;
}
