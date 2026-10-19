/**
 * Bridge: join open path ends with a curve that leaves each end along the
 * direction its path was heading, on whole paths or on the two anchors
 * selected in path edit.
 */
import { type Action, ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import {
  anchorEditWouldChange, commitAnchorEdit, depOf, joinPathsCommand, joinSelectedAnchors, pathOperationTags,
} from '@weasel-js/core';
import { icon } from '../icons.gen';

/** How long Bridge makes each handle, as a fraction of the gap, when its
 *  params name no `tension`. */
export const DEFAULT_BRIDGE_TENSION = 0.4;

/** A bridge's `params.tension`, or the default. Negative reads as `0`. */
export function bridgeTensionOf(params: Record<string, unknown> | undefined): number {
  const t = params?.tension;
  return typeof t === 'number' && Number.isFinite(t) ? Math.max(0, t) : DEFAULT_BRIDGE_TENSION;
}

/**
 * Bridge open paths: as `joinPaths`, but the gap is spanned by
 * a curve leaving each end along the direction its path was heading, each
 * handle `params.tension` times the gap long (default
 * {@link DEFAULT_BRIDGE_TENSION}). Two paths become one. In path edit,
 * `bridgeAnchors` bridges the two selected anchors instead.
 */
export const bridgePathsAction = joinPathsCommand(
  {
    id: 'bridgePaths',
    label: 'Bridge',
    icon: icon('core:bridge'),
    // `code` too: with Alt held on a Mac the key reads as another glyph.
    defaultBinding: { kind: 'key', key: 'j', code: 'KeyJ', mods: { alt: true } },
  },
  (params) => ({ tension: bridgeTensionOf(params) }),
);

const join = joinSelectedAnchors({});

/**
 * Bridge the two selected anchors, each the end of an open
 * subpath, as `joinAnchors` does, but with a curve leaving each end along the
 * direction its path was heading, each handle `params.tension` times the gap
 * long (`bridgePaths`'s default when absent). The anchor selection is
 * cleared.
 */
export const bridgeAnchorsAction: Action & { requires: string[] } = {
  id: 'bridgeAnchors',
  label: 'Bridge anchors',
  tags: pathOperationTags('command'),
  icon: icon('core:bridge'),
  group: 'anchors',
  defaultBinding: { kind: 'key', key: 'j', code: 'KeyJ', mods: { alt: true } },
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const dep = depOf(deps);
      if (!dep || dep.selectedAnchors.size !== 2) return;
      const selected = [...dep.selectedAnchors];
      const bridge = joinSelectedAnchors({ tension: bridgeTensionOf(params) });
      if (commitAnchorEdit(dep, 'Bridge anchors', (set) => bridge(set, selected))) dep.setSelectedAnchors([]);
    },
  } as ImmediateInvoker,
  enabled: (deps) => {
    const dep = depOf(deps);
    if (!dep || dep.selectedAnchors.size !== 2) return ActionDisabledReason.SelectionRequired;
    const selected = [...dep.selectedAnchors];
    return anchorEditWouldChange(deps, (set) => join(set, selected)) ? true : ActionDisabledReason.NotApplicable;
  },
};
