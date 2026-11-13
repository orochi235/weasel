import { useMemo } from 'react';
import { toolSet, type Tool, type ToolSet } from '@weasel-js/core';
import { useOrbitTool } from './tools';

/** The ids `useKernel3dTools` keys its tools by. */
export type Kernel3dToolId = 'orbit';

/** The 3D camera tools. */
export const KERNEL3D_TOOLS: ToolSet<Kernel3dToolId> = toolSet('kernel3d', ['orbit'], { label: '3D view' });

/** Every tool in {@link KERNEL3D_TOOLS}, keyed by id, for `<SceneCanvas tools>`. */
export function useKernel3dTools(): Record<Kernel3dToolId, Tool> {
  const orbit = useOrbitTool();
  return useMemo(() => ({ orbit }), [orbit]);
}
