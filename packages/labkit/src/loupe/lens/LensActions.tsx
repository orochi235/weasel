/**
 * Registers the lens actions on the lab, inside the Loupe keymap, and mounts
 * the dispatcher that feeds `loupe.follow` the pointer over the lab body.
 *
 * That dispatcher hears only hover, as `<LoupeGestures>`' does: `pointer`
 * would open a gesture on every press and capture the pointer away from the
 * stories. Its deps are a root of their own: every dispatcher publishes a
 * keymap stack as the `keymaps` dep, and under the lab's it would answer for
 * the lab's, so the Loupe leader would open a keymap nothing routes through.
 */
import {
  type ActionsRegistry,
  ActiveToolContextProvider,
  DepRegistryProvider,
  type Tool,
  useActionsRegistry,
  useGestureDispatcher,
} from '@weasel-js/core';
import { useLatest } from '@weasel-js/react';
import { type RefObject, useMemo } from 'react';
import { useLabAmbient } from '../../lab/labAmbient';
import {
  createLensActions,
  createLoupeKeymap,
  LENS_ACTION_IDS,
  type LensActionApi,
} from './lensActionDefs';

/** Props for `<LensActions>`. */
export interface LensActionsProps<C> {
  api: LensActionApi<C>;
  /** The lab body, where the Follow aim hears the pointer. */
  bodyRef: RefObject<HTMLElement | null>;
  /** The comparison `loupe.compare.opposite` sets. */
  opposite: () => C;
}

const NO_TOOLS: ReadonlyMap<string, Tool> = new Map();
const CHANNELS = {
  pointer: false,
  hover: true,
  wheel: false,
  pinch: false,
  contextMenu: false,
  ingest: false,
} as const;

function FollowDispatch({
  bodyRef,
  registry,
}: {
  bodyRef: RefObject<HTMLElement | null>;
  registry: ActionsRegistry;
}) {
  // It hears `loupe.follow` alone, so no other hover binding on the lab fires from it.
  const followOnly = useMemo<ActionsRegistry>(
    () => ({
      ...registry,
      list: () => registry.list().filter((a) => a.id === LENS_ACTION_IDS.followMove),
    }),
    [registry],
  );
  useGestureDispatcher({
    canvasRef: bodyRef,
    actions: followOnly,
    entriesById: NO_TOOLS,
    channels: CHANNELS,
    keyboard: false,
  });
  return null;
}

export function LensActions<C>({ api, bodyRef, opposite }: LensActionsProps<C>) {
  const registry = useActionsRegistry();
  const oppositeRef = useLatest(opposite);
  const keymap = useMemo(
    () => createLoupeKeymap(createLensActions(api, { opposite: () => oppositeRef.current() })),
    [api, oppositeRef],
  );
  useLabAmbient(keymap);
  if (!registry) return null;
  return (
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <FollowDispatch bodyRef={bodyRef} registry={registry} />
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
}
