/**
 * Produces a `ShapeSchema` per kind the `insert` dep builds a node for with no
 * consumer factory (`KIT_INSERT_KINDS` in `@weasel-js/editing`'s
 * `deps/insert.ts`). A kind's data is the object literal returned from the
 * `case '<kind>':` clause that builds it, spreads read through their types;
 * its pose is the dep's `pose`, the insert's resolved extent.
 */
import { Node, type Project, SyntaxKind, type ObjectLiteralExpression } from 'ts-morph';
import { resolve } from 'node:path';
import type { PropertyDescriptor, ShapeSchema } from '../src/dev/traitSchemas.types.ts';
import { srcRef, sourceFileOrThrow, readJsDoc } from './extract.ts';

export const SHAPES_SOURCE = 'packages/editing/src/deps/insert.ts';
const KINDS_NAME = 'KIT_INSERT_KINDS';
const POSE_NAME = 'pose';

export function extractShapes(project: Project, repoRoot: string): Record<string, ShapeSchema> {
  const sf = sourceFileOrThrow(project, resolve(repoRoot, SHAPES_SOURCE));
  const kindsDecl = sf.getVariableDeclarationOrThrow(KINDS_NAME);
  const kinds = kindsDecl.getDescendantsOfKind(SyntaxKind.StringLiteral).map((l) => l.getLiteralValue());

  const poseDecl = sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((d) => d.getName() === POSE_NAME);
  const poseInit = poseDecl?.getInitializer();
  const pose = poseInit ? propertiesOfType(poseInit) : [];

  const out: Record<string, ShapeSchema> = {};
  for (const kind of kinds) {
    const clause = sf.getDescendantsOfKind(SyntaxKind.CaseClause).find((c) => {
      const label = c.getExpression();
      return Node.isStringLiteral(label) && label.getLiteralValue() === kind;
    });
    const built = clause && returnedLiteral(clause);
    out[kind] = {
      id: kind,
      pose,
      data: built ? propertiesOfLiteral(built) : [],
      source: srcRef(clause ?? kindsDecl, repoRoot),
      ...(built ? {} : { notes: `no \`case '${kind}':\` returning an object literal in ${SHAPES_SOURCE}` }),
    };
  }
  return out;
}

/** The object literal the first `return` in `clause` returns. */
function returnedLiteral(clause: Node): ObjectLiteralExpression | undefined {
  for (const ret of clause.getDescendantsOfKind(SyntaxKind.ReturnStatement)) {
    const expr = ret.getExpression();
    if (expr && Node.isObjectLiteralExpression(expr)) return expr;
  }
  return undefined;
}

/** A literal's properties in order, a spread contributing the properties of its type. A later
 *  property replaces an earlier one of the same name. */
function propertiesOfLiteral(obj: ObjectLiteralExpression): readonly PropertyDescriptor[] {
  const byName = new Map<string, PropertyDescriptor>();
  const put = (p: PropertyDescriptor) => { byName.delete(p.name); byName.set(p.name, p); };
  for (const prop of obj.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const init = prop.getInitializer();
      const doc = readJsDoc(prop);
      const text = init?.getText();
      put({
        name: prop.getName(),
        type: init ? clipType(init.getType().getText(init)) : 'unknown',
        optional: false,
        ...(text !== undefined && text.length < 80 ? { defaultLiteral: text } : {}),
        ...(doc ? { doc } : {}),
      });
    } else if (Node.isShorthandPropertyAssignment(prop)) {
      put({ name: prop.getName(), type: clipType(prop.getType().getText(prop)), optional: false });
    } else if (Node.isSpreadAssignment(prop)) {
      for (const p of propertiesOfType(prop.getExpression())) put(p);
    }
  }
  return [...byName.values()];
}

function propertiesOfType(node: Node): readonly PropertyDescriptor[] {
  return node.getType().getProperties().map((sym) => ({
    name: sym.getName(),
    type: clipType(sym.getTypeAtLocation(node).getText(node)),
    optional: sym.isOptional(),
  }));
}

function clipType(t: string): string {
  if (t.length <= 120) return t;
  return `${t.slice(0, 117)}...`;
}
