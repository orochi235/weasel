import { toolSet, type ToolSet } from '@weasel-js/core';
import { useMemo } from 'react';
import type { Tool } from '@weasel-js/core';
import { useReachTool } from './reach/useReachTool';
import { useGirthTool } from './girth/useGirthTool';
import { useTugTool } from './tug/useTugTool';
import { useShapeBuilderTool } from './shapeBuilder/useShapeBuilderTool';
import { useSandTool } from './sand/useSandTool';
import { useKneadTool } from './knead/useKneadTool';
import { useSpiroTool } from './spiro/useSpiroTool';
import { useSnipTool } from './snip/useSnipTool';
import { usePlaneWarpTool, useClothWarpTool, usePinWarpTool } from './warp/useWarpTool';
import { usePenTool } from './pen/usePenTool';
import { usePencilTool } from './pencil/usePencilTool';
import { useSliceTool } from './slice/useSliceTool';
import { anchorsTool } from './pathEdit/anchorsTool';

/** The ids {@link usePathToolsTools} keys its tools by. */
export type PathToolId =
  | 'girth' | 'snip' | 'reach' | 'knead' | 'plane' | 'cloth' | 'pin' | 'spiro' | 'shapeBuilder' | 'pen' | 'pencil'
  | 'slice' | PathEditToolId;

/** The ids {@link usePathEditTools} keys its tools by. */
export type PathEditToolId = 'anchors' | 'sand' | 'tug';

/** The tools that pull a selected path's shape around as a whole: plane warp, cloth warp, and pin warp.
 *  A palette stacks them on one button. */
export const WARP_TOOLS: ToolSet<PathToolId> = toolSet('warp', ['plane', 'cloth', 'pin'], { stack: true, label: 'Warp' });

/** The tools that reshape paths already drawn: girth, the stroke tools, Knead, and the warps. */
export const RESHAPE_TOOLS: ToolSet<PathToolId> = toolSet('reshape', ['girth', 'snip', 'reach', 'knead', WARP_TOOLS], { label: 'Reshape' });

/** The path-edit tools: each changes what a drag in path edit does, and carries `edits-anchors`. The
 *  `anchors` tool, which binds nothing, is the one path edit starts on. */
export const PATH_EDIT_TOOLS: ToolSet<PathToolId> = toolSet('path-edit', ['anchors', 'sand', 'tug'], { label: 'Path edit' });

/** The tools that draw a path: the pen, the pencil and the spiro pen. */
export const DRAW_TOOLS: ToolSet<PathToolId> = toolSet('draw', ['pen', 'pencil', 'spiro'], { label: 'Draw' });

/** The knife (`slice`), which cuts what a line drawn across it crosses. */
export const SLICE_TOOLS: ToolSet<PathToolId> = toolSet('slice', ['slice'], { label: 'Slice' });

/** Every tool `@weasel-js/path-tools` ships: the path-edit tools, the pen and pencil, the reshaping tools, the
 *  spiro pen, the shape builder, and the knife. */
export const PATH_TOOLS_TOOLS: ToolSet<PathToolId> = toolSet(
  'path-tools', [PATH_EDIT_TOOLS, DRAW_TOOLS, RESHAPE_TOOLS, 'shapeBuilder', SLICE_TOOLS], { label: 'Path tools' },
);

/** Every tool in {@link PATH_EDIT_TOOLS}, keyed by id, each its own hook with its default options. */
export function usePathEditTools(): Record<PathEditToolId, Tool> {
  const sand = useSandTool();
  const tug = useTugTool();
  return useMemo(() => ({ anchors: anchorsTool, sand, tug }), [sand, tug]);
}

/**
 * Every tool in {@link PATH_TOOLS_TOOLS}, keyed by id, for `<SceneCanvas tools>` beside the
 * `pathToolsPreset` feature whose actions they bind. Each is the tool's own hook with its default
 * options; to configure one, call its hook and put that tool over this one's.
 */
export function usePathToolsTools(): Record<PathToolId, Tool> {
  const girth = useGirthTool();
  const snip = useSnipTool();
  const reach = useReachTool();
  const knead = useKneadTool();
  const plane = usePlaneWarpTool();
  const cloth = useClothWarpTool();
  const pin = usePinWarpTool();
  const spiro = useSpiroTool();
  const shapeBuilder = useShapeBuilderTool();
  const pen = usePenTool();
  const pencil = usePencilTool();
  const slice = useSliceTool();
  const pathEdit = usePathEditTools();
  return useMemo(
    () => ({ girth, snip, reach, knead, plane, cloth, pin, spiro, shapeBuilder, pen, pencil, slice, ...pathEdit }),
    [girth, snip, reach, knead, plane, cloth, pin, spiro, shapeBuilder, pen, pencil, slice, pathEdit],
  );
}
