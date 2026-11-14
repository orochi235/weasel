import { toolSet, type ToolSet } from '@weasel-js/core';
import { useMemo } from 'react';
import type { Tool } from '@weasel-js/core';
import { useReachTool } from './reach/useReachTool';
import { useGirthTool } from './girth/useGirthTool';
import { useLengthenTool } from './lengthen/useLengthenTool';
import { useShapeBuilderTool } from './shapeBuilder/useShapeBuilderTool';
import { useSandTool } from './sand/useSandTool';
import { useKneadTool } from './knead/useKneadTool';
import { useSpiroTool } from './spiro/useSpiroTool';
import { useSnipTool } from './snip/useSnipTool';
import { useDistortTool, useClothWarpTool, usePuppetTool } from './warp/useWarpTool';

/** The ids {@link usePathToolsTools} keys its tools by. */
export type PathToolId =
  | 'girth' | 'snip' | 'reach' | 'knead' | 'distort' | 'cloth' | 'puppet' | 'spiro' | 'shapeBuilder'
  | PathEditToolId;

/** The ids {@link usePathEditTools} keys its tools by. */
export type PathEditToolId = 'sand' | 'lengthen';

/** The tools that pull a selected path's shape around as a whole: distort, cloth warp, and puppet warp.
 *  A palette stacks them on one button. */
export const WARP_TOOLS: ToolSet<PathToolId> = toolSet('warp', ['distort', 'cloth', 'puppet'], { stack: true, label: 'Warp' });

/** The tools that reshape paths already drawn: girth, the stroke tools, Knead, and the warps. */
export const RESHAPE_TOOLS: ToolSet<PathToolId> = toolSet('reshape', ['girth', 'snip', 'reach', 'knead', WARP_TOOLS], { label: 'Reshape' });

/** The path-edit tools: each changes what a drag in path edit does, and carries `edits-anchors`.
 *  Core's `anchors` tool sits in the same palette group. */
export const PATH_EDIT_TOOLS: ToolSet<PathToolId> = toolSet('path-edit', ['sand', 'lengthen'], { label: 'Path edit' });

/** Every tool `@weasel-js/path-tools` ships: the reshaping tools, the spiro pen, the shape builder, and the
 *  path-edit tools. */
export const PATH_TOOLS_TOOLS: ToolSet<PathToolId> = toolSet('path-tools', [RESHAPE_TOOLS, 'spiro', 'shapeBuilder', PATH_EDIT_TOOLS], { label: 'Path tools' });

/** Every tool in {@link PATH_EDIT_TOOLS}, keyed by id, each its own hook with its default options. */
export function usePathEditTools(): Record<PathEditToolId, Tool> {
  const sand = useSandTool();
  const lengthen = useLengthenTool();
  return useMemo(() => ({ sand, lengthen }), [sand, lengthen]);
}

/**
 * Every tool in {@link PATH_TOOLS_TOOLS}, keyed by id, for `<SceneCanvas tools>` beside the
 * `pathTools` feature whose actions they bind. Each is the tool's own hook with its default
 * options; to configure one, call its hook and put that tool over this one's.
 */
export function usePathToolsTools(): Record<PathToolId, Tool> {
  const girth = useGirthTool();
  const snip = useSnipTool();
  const reach = useReachTool();
  const knead = useKneadTool();
  const distort = useDistortTool();
  const cloth = useClothWarpTool();
  const puppet = usePuppetTool();
  const spiro = useSpiroTool();
  const shapeBuilder = useShapeBuilderTool();
  const pathEdit = usePathEditTools();
  return useMemo(
    () => ({ girth, snip, reach, knead, distort, cloth, puppet, spiro, shapeBuilder, ...pathEdit }),
    [girth, snip, reach, knead, distort, cloth, puppet, spiro, shapeBuilder, pathEdit],
  );
}
