import type { ModeRegistry } from './registry';
import type { CapabilityTag } from './capabilities';
import { eligibleForMode } from './modeDefinition';

export interface ToolLike {
  id: string;
  capabilities?: readonly CapabilityTag[];
}

/** True iff `tool` is usable in the registry's currently active mode. */
export function eligibleTool(reg: ModeRegistry, tool: ToolLike): boolean {
  return eligibleForMode(reg.current(), tool.capabilities ?? []);
}
