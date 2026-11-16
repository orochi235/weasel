import { useScopedTools, useToolOptionParams } from '@weasel-js/routing/react';
import { setToolOption, type Tool, type ToolOptionValues, type ToolsApi } from '@weasel-js/core';
import { ToolOptionsBar, type ToolOptionsBarProps } from './ToolOptionsBar';
import { getOwn } from '@weasel-js/registry';

/** Props for {@link ActiveToolOptionsBar}. */
export interface ActiveToolOptionsBarProps extends Omit<ToolOptionsBarProps, 'label' | 'schema' | 'values' | 'onChange' | 'mixed' | 'over'> {
  /** The tool whose options to draw. Omitted, the active tool of `tools`. */
  tool?: Pick<Tool, 'id' | 'options' | 'presentation'>;
  /** The canvas's tools; the bar follows the active one. Omitted, the tools of the canvas the bar sits in, or beside
   *  under a shared `WeaselProvider` (`useScopedTools`). */
  tools?: Pick<ToolsApi, 'active' | 'registry'> | null;
  /** Where the host keeps its tools' option values: the store it passes as `<SceneCanvas toolOptionValues>`. */
  values: ToolOptionValues;
}

/**
 * A {@link ToolOptionsBar} for a tool's own options (`ToolDef.options`): labeled with the tool's name, its controls
 * drawn from the tool's schema over `values`, and every edit written back with `setToolOption`, so a shared option
 * moves for every tool sharing it. A change made elsewhere, such as a key stepping a size, redraws it. Renders nothing
 * for no tool, or one with no options and no children.
 */
export function ActiveToolOptionsBar({ tool, tools, values, children, ...bar }: ActiveToolOptionsBarProps) {
  const scoped = useScopedTools();
  const followed = tools ?? scoped;
  const shown = tool ?? (followed?.active ? getOwn(followed.registry, followed.active) : undefined);
  const params = useToolOptionParams(shown, values);
  const options = shown?.options;
  if (!shown || !options || !params) return <ToolOptionsBar {...bar}>{children}</ToolOptionsBar>;
  return (
    <ToolOptionsBar
      {...bar}
      label={shown.presentation?.label}
      schema={options.prefs}
      values={params}
      onChange={(path, value) => setToolOption(shown.id, options, values, path, value)}
    >
      {children}
    </ToolOptionsBar>
  );
}
