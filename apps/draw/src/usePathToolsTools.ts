import type { Tool } from '@weasel-js/core';
import {
  useDistortTool, useEnvelopeTool, useExtendTool, usePuppetTool, useSmudgeBrushTool, useTrimTool, useGirthTool,
} from '@weasel-js/path-tools';
import { useMemo } from 'react';

/** The ids `usePathToolsTools` keys its tools by, in palette order. */
export const PATH_TOOL_IDS = ['girth', 'trim', 'extend', 'smudgeBrush', 'distort', 'envelope', 'puppet'] as const;

const PATH_TOOL_ID_SET: ReadonlySet<string> = new Set(PATH_TOOL_IDS);

/** Whether `tool` is one of `@weasel-js/path-tools`' tools. */
export const isPathTool = (tool: Tool): boolean => PATH_TOOL_ID_SET.has(tool.id);

/** Every tool `@weasel-js/path-tools` exports, keyed by tool id, for `<SceneCanvas tools>`
 *  beside the `pathTools` feature whose actions they bind. */
export function usePathToolsTools(): Record<(typeof PATH_TOOL_IDS)[number], Tool> {
  const girth = useGirthTool();
  const trim = useTrimTool();
  const extend = useExtendTool();
  const smudgeBrush = useSmudgeBrushTool();
  const distort = useDistortTool();
  const envelope = useEnvelopeTool();
  const puppet = usePuppetTool();
  return useMemo(
    () => ({ girth, trim, extend, smudgeBrush, distort, envelope, puppet }),
    [girth, trim, extend, smudgeBrush, distort, envelope, puppet],
  );
}
