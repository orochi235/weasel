/**
 * The options row of the active tool: whatever it declares in `ToolDef.options`,
 * drawn from that schema, over the values the host keeps for it.
 */
import { useCallback, useSyncExternalStore, type ReactElement } from 'react';
import { toolOptionParams, type Tool, type ToolOptionValues } from '@weasel-js/core';
import { ToolOptionsBar } from '@weasel-js/ui/components/ToolOptionsBar';

export interface ActiveToolOptionsProps {
  /** The active tool, if any. */
  tool: Tool | undefined;
  values: ToolOptionValues;
}

export function ActiveToolOptions({ tool, values }: ActiveToolOptionsProps): ReactElement | null {
  const subscribe = useCallback((listener: () => void) => values.subscribe(listener), [values]);
  const held = useSyncExternalStore(subscribe, () => (tool ? values.get(tool.id) : null));
  const options = tool?.options;
  if (!tool || !options || !held) return null;
  return (
    <ToolOptionsBar
      label={tool.presentation?.label}
      schema={options.prefs}
      values={toolOptionParams(tool.id, options, values)}
      onChange={(path, value) => {
        if (typeof value === 'number') values.set(tool.id, path, value);
      }}
    />
  );
}
