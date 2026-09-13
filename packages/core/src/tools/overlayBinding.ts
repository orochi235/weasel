/**
 * The routing types that carry an overlay, bound to the kit's `RenderLayer`.
 *
 * `@weasel-js/routing` never reads an overlay — it collects the live ones and
 * hands them back in scope order — so it leaves the element type open. What a
 * weasel canvas draws is a `RenderLayer`, and every kit call site should see
 * that rather than `unknown`, so core binds the parameter once, here, and
 * re-exports these names under the ones they have always had.
 */
import type { RenderLayer } from 'core/layers/render';
import { defineTool as routingDefineTool, defineViewportTool as routingDefineViewportTool } from '@weasel-js/routing';
import { useTools as routingUseTools, useContributions as routingUseContributions } from '@weasel-js/routing/react';
import type {
  Contribution as RoutingContribution,
  ContributionChrome as RoutingContributionChrome,
  Tool as RoutingTool,
  ToolDef as RoutingToolDef,
  ViewportToolDef as RoutingViewportToolDef,
  AnyToolOf,
} from '@weasel-js/routing';
import type {
  ToolsApi as RoutingToolsApi,
  UseToolsOptions as RoutingUseToolsOptions,
  ContributionsApi as RoutingContributionsApi,
  UseContributionsOptions as RoutingUseContributionsOptions,
} from '@weasel-js/routing/react';

/** What a canvas overlay is, at this layer. */
export type Overlay = RenderLayer<unknown>;

export type Contribution = RoutingContribution<Overlay>;
export type ContributionChrome = RoutingContributionChrome<Overlay>;
export type Tool<TScratch = unknown> = RoutingTool<TScratch, Overlay>;
export type AnyTool = AnyToolOf<Overlay>;
export type ToolDef<TScratch = void> = RoutingToolDef<TScratch, Overlay>;
export type ViewportToolDef<TScratch = void> = RoutingViewportToolDef<TScratch, Overlay>;
export type ToolsApi = RoutingToolsApi<Overlay>;
export type UseToolsOptions = RoutingUseToolsOptions<Overlay>;
export type ContributionsApi = RoutingContributionsApi<Overlay>;
export type UseContributionsOptions = RoutingUseContributionsOptions<Overlay>;

// The value-side seam. Each of these is routing's own function with `TOverlay`
// instantiated at `Overlay`, so a `defineTool({ overlay })` in core or in a
// consumer produces a `Tool` whose overlay is a `RenderLayer` rather than
// `unknown`, and nothing downstream has to name the parameter.
export function defineTool<TScratch = void>(def: ToolDef<TScratch>): Tool<TScratch> {
  return routingDefineTool<TScratch, Overlay>(def);
}
export function defineViewportTool<TScratch = void>(def: ViewportToolDef<TScratch>): Tool<TScratch> {
  return routingDefineViewportTool<TScratch, Overlay>(def);
}
export const useTools: (opts: UseToolsOptions) => ToolsApi = routingUseTools;
export const useContributions: (opts: UseContributionsOptions) => ContributionsApi =
  routingUseContributions;
