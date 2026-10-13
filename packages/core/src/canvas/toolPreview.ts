import type { ToolsApi, AnyTool } from '../tools/overlayBinding';
import type { GesturePreviewSource } from './gestureBounds';

/**
 * Every registered tool, as a preview source: hotkey-engaged, active, the rest
 * of the registry, then ambient, each once.
 *
 * No canvas reads this, and `Tool` declares no preview member. It is here for
 * `SceneCanvas/usePreviewGhostLayer.test.tsx`, which plants a preview on a tool.
 */
export function toolPreviewSources(tools: ToolsApi | undefined): GesturePreviewSource[] {
  if (!tools) return [];
  const hotkey = tools.hotkeyEngaged ? tools.registry[tools.hotkeyEngaged] : undefined;
  const active = tools.active === null ? undefined : tools.registry[tools.active];
  const all: (AnyTool | undefined)[] = [hotkey, active, ...Object.values(tools.registry), ...tools.ambient];
  return [...new Set(all.filter((t): t is AnyTool => !!t))] as GesturePreviewSource[];
}
