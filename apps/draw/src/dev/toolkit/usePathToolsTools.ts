import type { Tool } from '@weasel-js/core';
import {
  useDistortTool, useEnvelopeTool, useExtendTool, usePuppetTool, useSmudgeBrushTool, useTrimTool, useWidthTool,
} from '@weasel-js/path-tools';
import { useMemo } from 'react';

/** Every tool `@weasel-js/path-tools` exports, keyed by tool id, for `<SceneCanvas tools>`
 *  beside the `pathTools` feature whose actions they bind. */
export function usePathToolsTools(): Record<string, Tool> {
  const trim = useTrimTool();
  const extend = useExtendTool();
  const smudgeBrush = useSmudgeBrushTool();
  const width = useWidthTool();
  const distort = useDistortTool();
  const envelope = useEnvelopeTool();
  const puppet = usePuppetTool();
  return useMemo(
    () => ({ trim, extend, smudgeBrush, width, distort, envelope, puppet }),
    [trim, extend, smudgeBrush, width, distort, envelope, puppet],
  );
}
