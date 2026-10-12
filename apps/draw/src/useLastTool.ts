import type { ToolsApi } from '@weasel-js/core';
import { useEffect, useRef } from 'react';
import { usePref } from './prefs';

/** Keeps `tools.lastTool` true to its name: activates the stored tool once the
 *  canvas has built its tools, then stores each tool the user switches to. */
export function useLastTool(tools: ToolsApi | null): void {
  const [lastTool, setLastTool] = usePref('tools.lastTool');
  const restored = useRef(false);
  const active = tools?.active ?? null;
  useEffect(() => {
    if (!tools) return;
    if (!restored.current) {
      restored.current = true;
      if (lastTool !== active && tools.has(lastTool)) tools.setActive(lastTool);
      return;
    }
    if (active !== null && active !== lastTool) setLastTool(active);
    // The pref is read once, at restore; after that the active tool leads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools, active]);
}
