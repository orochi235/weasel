import { toolSet, type ToolSet } from '@weasel-js/core';
import { useMemo } from 'react';
import type { Tool } from '@weasel-js/core';
import { useExtendTool } from './extend/useExtendTool';
import { useGirthTool } from './girth/useGirthTool';
import { useLengthenTool } from './lengthen/useLengthenTool';
import { useShapeBuilderTool } from './shapeBuilder/useShapeBuilderTool';
import { useSimplifyBrushTool } from './simplifyBrush/useSimplifyBrushTool';
import { useSmudgeBrushTool } from './smudge/useSmudgeBrushTool';
import { useSpiroTool } from './spiro/useSpiroTool';
import { useTrimTool } from './trim/useTrimTool';
import { useDistortTool, useEnvelopeTool, usePuppetTool } from './warp/useWarpTool';

/** The ids {@link usePathToolsTools} keys its tools by. */
export type PathToolId =
  | 'girth' | 'trim' | 'extend' | 'smudgeBrush' | 'distort' | 'envelope' | 'puppet' | 'spiro' | 'shapeBuilder'
  | PathEditToolId;

/** The ids {@link usePathEditTools} keys its tools by. */
export type PathEditToolId = 'simplifyBrush' | 'lengthen';

/** The tools that pull a selected path's shape around as a whole: distort, envelope mesh, and puppet warp. */
export const WARP_TOOLS: ToolSet<PathToolId> = toolSet('warp', ['distort', 'envelope', 'puppet']);

/** The tools that reshape paths already drawn: girth, the stroke tools, the smudge brush, and the warps. */
export const RESHAPE_TOOLS: ToolSet<PathToolId> = toolSet('reshape', ['girth', 'trim', 'extend', 'smudgeBrush', WARP_TOOLS]);

/** The path-edit tools: each changes what a drag in path edit does, and carries `edits-anchors`.
 *  Core's `anchors` tool sits in the same palette group. */
export const PATH_EDIT_TOOLS: ToolSet<PathToolId> = toolSet('path-edit', ['simplifyBrush', 'lengthen']);

/** Every tool `@weasel-js/path-tools` ships: the reshaping tools, the spiro pen, the shape builder, and the
 *  path-edit tools. */
export const PATH_TOOLS_TOOLS: ToolSet<PathToolId> = toolSet('path-tools', [RESHAPE_TOOLS, 'spiro', 'shapeBuilder', PATH_EDIT_TOOLS]);

/** Every tool in {@link PATH_EDIT_TOOLS}, keyed by id, each its own hook with its default options. */
export function usePathEditTools(): Record<PathEditToolId, Tool> {
  const simplifyBrush = useSimplifyBrushTool();
  const lengthen = useLengthenTool();
  return useMemo(() => ({ simplifyBrush, lengthen }), [simplifyBrush, lengthen]);
}

/**
 * Every tool in {@link PATH_TOOLS_TOOLS}, keyed by id, for `<SceneCanvas tools>` beside the
 * `pathTools` feature whose actions they bind. Each is the tool's own hook with its default
 * options; to configure one, call its hook and put that tool over this one's.
 */
export function usePathToolsTools(): Record<PathToolId, Tool> {
  const girth = useGirthTool();
  const trim = useTrimTool();
  const extend = useExtendTool();
  const smudgeBrush = useSmudgeBrushTool();
  const distort = useDistortTool();
  const envelope = useEnvelopeTool();
  const puppet = usePuppetTool();
  const spiro = useSpiroTool();
  const shapeBuilder = useShapeBuilderTool();
  const pathEdit = usePathEditTools();
  return useMemo(
    () => ({ girth, trim, extend, smudgeBrush, distort, envelope, puppet, spiro, shapeBuilder, ...pathEdit }),
    [girth, trim, extend, smudgeBrush, distort, envelope, puppet, spiro, shapeBuilder, pathEdit],
  );
}
