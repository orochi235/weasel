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
import { useTools as routingUseTools, useContributions as routingUseContributions } from '@weasel-js/routing/react';
import type {
  Contribution as RoutingContribution,
  ContributionChrome as RoutingContributionChrome,
  Tool as RoutingTool,
  ToolDef as RoutingToolDef,
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

declare module '@weasel-js/routing' {
  interface OverlaySchema { overlay: RenderLayer<unknown> }
}

/** Routing's `Contribution`, with overlays typed as `RenderLayer`. */
export type Contribution = RoutingContribution<Overlay>;
/** Routing's `ContributionChrome`, with overlays typed as `RenderLayer`. */
export type ContributionChrome = RoutingContributionChrome<Overlay>;
/** Routing's `Tool`, with overlays typed as `RenderLayer`. */
export type Tool<TScratch = unknown> = RoutingTool<TScratch, Overlay>;
/** A `Tool` of any scratch type: the element type for a list of mixed tools. */
export type AnyTool = AnyToolOf<Overlay>;
/** Routing's `ToolDef` (what `defineTool` takes), with overlays typed as `RenderLayer`. */
export type ToolDef<TScratch = void> = RoutingToolDef<TScratch, Overlay>;
/** Routing's `ToolsApi`, with overlays typed as `RenderLayer`. */
export type ToolsApi = RoutingToolsApi<Overlay>;
/** Routing's `UseToolsOptions`, with overlays typed as `RenderLayer`. */
export type UseToolsOptions = RoutingUseToolsOptions<Overlay>;
export type ContributionsApi = RoutingContributionsApi<Overlay>;
export type UseContributionsOptions = RoutingUseContributionsOptions<Overlay>;

// Routing's own authoring functions: the `OverlaySchema` merge above makes
// their overlay default `Overlay`, so there is one `defineTool`, not a wrapper.
export { defineTool } from '@weasel-js/routing';
/** Routing's `useTools`, typed for `RenderLayer` overlays. */
export const useTools: (opts: UseToolsOptions) => ToolsApi = routingUseTools;
export const useContributions: (opts: UseContributionsOptions) => ContributionsApi =
  routingUseContributions;
