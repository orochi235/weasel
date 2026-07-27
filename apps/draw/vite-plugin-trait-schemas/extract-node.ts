/**
 * Extract the SceneNode discriminated union shape.
 *
 * Reads `packages/core/src/core/scene/types.ts` and assembles a `SceneNodeSchema`:
 *   - `kinds`: the discriminator values pulled from each variant's `kind`
 *     property string-literal type.
 *   - `variants`: one entry per variant interface (`LeafNode`, `ContainerNode`)
 *     with all properties — including those inherited from `NodeBase` —
 *     merged in declaration order (base first, variant-specific second).
 *   - `source`: location of the `Node` type alias (the public re-export
 *     `SceneNode` aliases this one).
 */
import {
  type Project,
  type InterfaceDeclaration,
  type PropertySignature,
  SyntaxKind,
} from 'ts-morph';
import { resolve } from 'node:path';
import type {
  SceneNodeSchema,
  SceneNodeVariant,
  PropertyDescriptor,
} from '../src/dev/traitSchemas.types';
import { srcRef, sourceFileOrThrow, readJsDoc } from './extract';

const VARIANT_NAMES: readonly string[] = ['LeafNode', 'ContainerNode'];
const BASE_NAME = 'NodeBase';
const UNION_NAME = 'Node';

export function extractNode(project: Project, repoRoot: string): SceneNodeSchema {
  const sf = sourceFileOrThrow(
    project,
    resolve(repoRoot, 'packages/core/src/core/scene/types.ts'),
  );

  const base = sf.getInterface(BASE_NAME);
  const baseProps = base ? propertiesOfInterface(base) : [];

  const variants: SceneNodeVariant[] = [];
  const kinds: string[] = [];
  for (const name of VARIANT_NAMES) {
    const iface = sf.getInterface(name);
    if (!iface) continue;

    const ownProps = propertiesOfInterface(iface);
    // Base properties first, then variant-specific. Drop any duplicate
    // by name (variant override wins).
    const ownNames = new Set(ownProps.map((p) => p.name));
    const merged: PropertyDescriptor[] = [
      ...baseProps.filter((p) => !ownNames.has(p.name)),
      ...ownProps,
    ];

    const kind = readKindLiteral(iface) ?? name;
    kinds.push(kind);
    variants.push({ kind, properties: merged });
  }

  const unionAlias = sf.getTypeAlias(UNION_NAME);
  const source = unionAlias
    ? srcRef(unionAlias, repoRoot)
    : { file: 'packages/core/src/core/scene/types.ts', line: 1 };

  return { kinds, variants, source };
}

function propertiesOfInterface(iface: InterfaceDeclaration): readonly PropertyDescriptor[] {
  const out: PropertyDescriptor[] = [];
  for (const member of iface.getMembers()) {
    if (member.getKind() !== SyntaxKind.PropertySignature) continue;
    const ps = member as PropertySignature;
    const typeNode = ps.getTypeNode();
    out.push({
      name: ps.getName(),
      type: typeNode ? typeNode.getText() : 'unknown',
      optional: ps.hasQuestionToken(),
      doc: readJsDoc(ps),
    });
  }
  return out;
}

/** Pull the `kind` property's string-literal value (e.g. `'leaf'`) from a
 *  variant interface. Returns undefined if the property is missing or its
 *  type isn't a single literal. */
function readKindLiteral(iface: InterfaceDeclaration): string | undefined {
  const prop = iface.getProperty('kind');
  if (!prop) return undefined;
  const typeNode = prop.getTypeNode();
  if (!typeNode) return undefined;
  if (typeNode.getKind() === SyntaxKind.LiteralType) {
    const literal = (typeNode as unknown as { getLiteral: () => { getText: () => string } }).getLiteral();
    const text = literal.getText();
    return text.replace(/^['"`]|['"`]$/g, '');
  }
  // Fallback: strip quotes from the textual form.
  const text = typeNode.getText().trim();
  const m = text.match(/^['"`](.+)['"`]$/);
  return m ? m[1] : undefined;
}
