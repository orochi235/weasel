/**
 * Wires the `modeDefaultTool` dep: the tool the canvas's active mode starts
 * on, when the canvas mounts it and the tool can be made active: a registry tool, never an ambient one. Absent with
 * no mode registry.
 */
import { defaultToolOf, type ModeRegistry } from '@weasel-js/modes';
import { useLatest } from '@weasel-js/react';
import { useDepSource } from '@weasel-js/routing/react';
import type { ToolsApi } from 'tools/overlayBinding';

export function useModeDefaultToolDepSource(modes: ModeRegistry | undefined, tools: Pick<ToolsApi, 'registry'>): void {
  const ref = useLatest({ modes, tools });
  useDepSource('modeDefaultTool', () => {
    const { modes: m } = ref.current;
    return m ? () => defaultToolOf(m.current(), (id) => Object.hasOwn(ref.current.tools.registry, id)) : undefined;
  });
}
