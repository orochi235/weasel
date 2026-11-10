/**
 * The options row of the active tool: whatever it declares in `ToolDef.options`,
 * drawn from that schema, over the values the host keeps for it.
 */
import type { ReactElement } from 'react';
import { setToolOption, useToolOptionParams, type Tool, type ToolOptionValues } from '@weasel-js/core';
import { ToolOptionsBar } from '@weasel-js/ui/components/ToolOptionsBar';

export interface ActiveToolOptionsProps {
  /** The active tool, if any. */
  tool: Tool | undefined;
  values: ToolOptionValues;
}

export function ActiveToolOptions({ tool, values }: ActiveToolOptionsProps): ReactElement | null {
  const params = useToolOptionParams(tool, values);
  const options = tool?.options;
  if (!tool || !options || !params) return null;
  return (
    <ToolOptionsBar
      label={tool.presentation?.label}
      schema={options.prefs}
      values={params}
      onChange={(path, value) => setToolOption(tool.id, options, values, path, value)}
    />
  );
}
