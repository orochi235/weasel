/**
 * ts-morph based extractor that reads the @orochi235/weasel kit source and
 * produces a TraitSchemaIndex describing shape kinds, op factories, actions,
 * gestures, and the SceneNode discriminated union.
 *
 * The extractor is intentionally read-only: it never invokes the type checker
 * on app code, only on the kit source under `${repoRoot}/src`. The Vite
 * plugin calls this once on first virtual-module load and again whenever the
 * watched files change.
 */
import { Project, type Node, SyntaxKind, type SourceFile } from 'ts-morph';
import { resolve, relative } from 'node:path';
import type {
  TraitSchemaIndex,
  SceneNodeSchema,
  PropertyDescriptor,
  SourceRef,
} from '../src/dev/traitSchemas.types';
import { extractShapes } from './extract-shapes';
import { extractOps } from './extract-ops';
import { extractActions } from './extract-actions';
import { extractGestures } from './extract-gestures';
import { extractNode } from './extract-node';

/** Source files (absolute paths) that the extractor reads. Returned so the
 *  Vite plugin can wire them into the dev-server file watcher. */
export function watchedFilesFor(repoRoot: string): readonly string[] {
  return [
    resolve(repoRoot, 'src/canvas/SceneCanvas/useBuiltinShapeTools.tsx'),
    resolve(repoRoot, 'src/core/ops/index.ts'),
    resolve(repoRoot, 'src/core/ops/create.ts'),
    resolve(repoRoot, 'src/core/ops/delete.ts'),
    resolve(repoRoot, 'src/core/ops/transform.ts'),
    resolve(repoRoot, 'src/core/ops/reparent.ts'),
    resolve(repoRoot, 'src/core/ops/select.ts'),
    resolve(repoRoot, 'src/core/ops/setText.ts'),
    resolve(repoRoot, 'src/core/ops/setPath.ts'),
    resolve(repoRoot, 'src/interactions/actions/registry.tsx'),
    resolve(repoRoot, 'src/interactions/actions/defaults/index.ts'),
    resolve(repoRoot, 'src/interactions/gestures/types.ts'),
    resolve(repoRoot, 'src/core/scene/types.ts'),
  ];
}

export function extractTraitSchemas(repoRoot: string): TraitSchemaIndex {
  const project = new Project({
    tsConfigFilePath: resolve(repoRoot, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: false,
    skipFileDependencyResolution: false,
  });

  // Each surface lives in its own extractor module — they all share helpers
  // from this file but the per-surface logic is kept separate so a failure
  // in one (e.g. action-registry refactor) doesn't blow up the others.
  const shapes = safe('shapes', () => extractShapes(project, repoRoot)) ?? {};
  const ops = safe('ops', () => extractOps(project, repoRoot)) ?? {};
  const actions = safe('actions', () => extractActions(project, repoRoot)) ?? {};
  const gestures = safe('gestures', () => extractGestures(project, repoRoot)) ?? {};
  const node = safe('node', () => extractNode(project, repoRoot)) ?? FALLBACK_NODE;

  return {
    shapes, ops, actions, gestures, node,
    extractedAt: Date.now(),
  };
}

function safe<T>(label: string, fn: () => T): T | null {
  try { return fn(); }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // The plugin runs in dev only — log so the failure surfaces in the Vite
    // console without breaking the inspector.

    console.warn(`[trait-schemas] ${label} extractor failed: ${msg}`);
    return null;
  }
}

const FALLBACK_NODE: SceneNodeSchema = {
  kinds: [],
  variants: [],
  source: { file: 'src/core/scene/types.ts', line: 1 },
};

// ----- shared helpers used by per-surface extractors --------------------

export function srcRef(node: Node, repoRoot: string): SourceRef {
  const sf = node.getSourceFile();
  return {
    file: relative(repoRoot, sf.getFilePath()).replace(/\\/g, '/'),
    line: sf.getLineAndColumnAtPos(node.getStart()).line,
  };
}

export function readJsDoc(node: Node): string | undefined {
  const ranges = node.getLeadingCommentRanges();
  if (!ranges || ranges.length === 0) return undefined;
  const text = ranges
    .map((r) => node.getSourceFile().getFullText().slice(r.getPos(), r.getEnd()))
    .join('\n');
  return stripJsDoc(text);
}

export function stripJsDoc(raw: string): string {
  return raw
    .replace(/^\s*\/\*\*?/, '')
    .replace(/\*\/\s*$/, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, ''))
    .join('\n')
    .trim();
}

/** Render a TS type as a short string. Uses the type checker's text, falling
 *  back to the textual annotation when checker output is unbounded. */
export function typeText(node: Node): string {
  try {
    const t = node.getType().getText(node);
    if (t.length < 240) return t;
  } catch { /* fall through */ }
  if (node.getKind() === SyntaxKind.PropertySignature || node.getKind() === SyntaxKind.PropertyDeclaration) {
    const ta = (node as unknown as { getTypeNode?: () => Node | undefined }).getTypeNode?.();
    if (ta) return ta.getText();
  }
  return node.getText();
}

/** Convert a TS interface or type-literal node into PropertyDescriptors. */
export function propertiesOfTypeNode(typeNode: Node): readonly PropertyDescriptor[] {
  const out: PropertyDescriptor[] = [];
  typeNode.forEachChild((child) => {
    if (child.getKind() !== SyntaxKind.PropertySignature) return;
    const ps = child as unknown as {
      getName: () => string;
      hasQuestionToken: () => boolean;
      getTypeNode: () => Node | undefined;
    };
    const typeNode2 = ps.getTypeNode();
    out.push({
      name: ps.getName(),
      type: typeNode2 ? typeNode2.getText() : 'unknown',
      optional: ps.hasQuestionToken(),
      doc: readJsDoc(child),
    });
  });
  return out;
}

export function sourceFileOrThrow(project: Project, path: string): SourceFile {
  const sf = project.getSourceFile(path);
  if (!sf) throw new Error(`source file not found in project: ${path}`);
  return sf;
}
