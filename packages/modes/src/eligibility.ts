import type { ModeRegistry } from './registry';
import type { ModeDefinition } from './modeDefinition';
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

/** Same predicate against an explicit mode + tag list. Useful for palette
 *  preview ("if I were in mode X, would this tool be available?"). */
export function eligibleToolByCapabilities(
  mode: ModeDefinition,
  capabilities: readonly CapabilityTag[],
): boolean {
  return eligibleForMode(mode, capabilities);
}
