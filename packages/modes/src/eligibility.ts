import type { ModeRegistry } from './registry';
import type { CapabilityTag } from './capabilities';
import { eligibleForMode } from './modeDefinition';

/** The part of a tool this package needs in order to judge eligibility: its
 *  id and the capabilities it claims. Structural, so a real `ToolDef`
 *  satisfies it without this package depending on the kit. */
export interface ToolLike {
  id: string;
  capabilities?: readonly CapabilityTag[];
}

/** True iff `tool` is usable in the registry's currently active mode. */
export function eligibleTool(reg: ModeRegistry, tool: ToolLike): boolean {
  return eligibleForMode(reg.current(), tool.capabilities ?? []);
}

/** The part of a contribution this package needs in order to judge eligibility: its id and
 *  the capabilities its eligibility claims. Structural, as {@link ToolLike} is. */
export interface ContributionLike {
  id: string;
  eligibility?: { capabilities?: readonly CapabilityTag[] };
}

/** True iff a contribution is usable in the registry's active mode. */
export function eligibleContribution(reg: ModeRegistry, entry: ContributionLike): boolean {
  return eligibleForMode(reg.current(), entry.eligibility?.capabilities ?? []);
}
