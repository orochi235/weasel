/**
 * Mounts the gesture dispatcher: composes the input channels (keys, wheel,
 * WebKit gesture events, pointer events, and multi-touch synthesized from
 * them) and routes each event to the dispatcher for the view it landed in.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isApplePlatform, type ClickMemory } from '@weasel-js/gestures';
import { useKitSettings, useLatest } from '@weasel-js/react';
import { useActiveToolContext } from '../actions/activeToolContext';
import { actionsNodeOf } from '../actions/ActionsProvider';
import type { ActionSource } from '../actions/action';
import { useDepRegistry } from '../actions/depRegistry';
import { useToolLifecycle } from '../../tools/useToolLifecycle';
import { createDispatcher, createDispatchTrace, type Dispatcher, type DispatcherContext } from './dispatcher';
import { attachInput } from './attachInput';
import { createKeymapStack } from '../../keymaps/keymapStack';
import type { DispatcherViewTarget, UseGestureDispatcherOptions } from './gestureDispatcherOptions';

export type {
  DispatcherChannels, DispatcherViewTarget, UseGestureDispatcherOptions, ViewIdResolver,
} from './gestureDispatcherOptions';

/**
 * Attach the input pipeline to a canvas: DOM pointer, wheel, keyboard, and
 * multitouch listeners in, normalized input events out, routed through the
 * dispatcher to whichever action a binding names.
 *
 * The active tool and the dep registry come from context, so it must be
 * mounted inside `<SceneCanvas>`'s providers.
 */
export function useGestureDispatcher(opts: UseGestureDispatcherOptions): void {
  const { canvasRef, actions, entriesById, enabled = true, keyboard = true, affordanceAt, classifyTarget, dispatcher: dispatcherOpt, trace: traceOpt, clientToWorld, clientToLocal, requestRedraw, paintedCursor, cursorSink, getRuleCtx, onClick, onDoubleClick, views, channels, longPress, claimKeys = false, hears = 'scope', yieldKeys = false } = opts;
  // Read out as booleans, not the object: the attach effect depends on
  // them, and an inline `channels={{...}}` would re-bind every listener on
  // every render.
  const pointerChannel = channels?.pointer !== false;
  const hoverChannel = channels?.hover ?? pointerChannel;
  const wheelChannel = channels?.wheel !== false;
  const pinchChannel = channels?.pinch !== false;
  const contextMenuChannel = channels?.contextMenu !== false;
  const ingestChannel = channels?.ingest !== false;
  const carryChannel = channels?.carry !== false;
  const onClickRef = useLatest(onClick);
  const onDoubleClickRef = useLatest(onDoubleClick);
  const activeTool = useActiveToolContext();
  const depRegistry = useDepRegistry();
  const [isMac] = useState(isApplePlatform);

  const [keymaps] = useState(createKeymapStack);
  useEffect(() => depRegistry.register('keymaps', () => keymaps), [depRegistry, keymaps]);
  const kitSettings = useKitSettings();

  const [ownTrace] = useState(createDispatchTrace);
  const trace = traceOpt ?? ownTrace;
  useEffect(() => depRegistry.register('dispatchTrace', () => trace), [depRegistry, trace]);

  const dispatcherRef = useRef<Dispatcher | null>(null);
  if (!dispatcherRef.current) {
    dispatcherRef.current = dispatcherOpt ?? createDispatcher();
  }

  // No `getRuleCtx` here: eligibility is a per-view answer, so it rides on the
  // dispatch record and the core installs the routed view's.
  const registryRef = useLatest(actions);
  const heard = useMemo<ActionSource>(() => {
    const node = hears === 'own' ? actionsNodeOf(actions) : null;
    return node ? { list: () => node.ownActions() } : actions;
  }, [actions, hears]);
  const ctxRef = useLatest<DispatcherContext>({
    actions: heard,
    depRegistry,
    activeToolId: activeTool.active,
    hotkeyStack: activeTool.hotkeyStack,
    entriesById,
    isMac,
    trace,
    bindingOverrides: () => registryRef.current.bindingOverrides(),
    keymaps,
    leaderUnbound: kitSettings.get('gestures.keymapUnbound'),
  });

  // The flat options are view zero.
  const rootTargetRef = useLatest<DispatcherViewTarget>({
    id: null, dispatcher: dispatcherRef.current, affordanceAt, classifyTarget, clientToWorld,
    getRuleCtx,
  });
  const viewsRef = useLatest(views);
  const clientToLocalRef = useLatest(clientToLocal);

  /** Every live dispatcher — what a cancel-everything has to reach. */
  const allDispatchers = useCallback((): Dispatcher[] => [
    rootTargetRef.current.dispatcher,
    ...(viewsRef.current?.targets() ?? []).map((t) => t.dispatcher),
  ], [rootTargetRef, viewsRef]);
  const requestRedrawRef = useLatest(requestRedraw);
  const cursorRef = useLatest({ painted: paintedCursor, sink: cursorSink });
  const longPressRef = useLatest(longPress);
  const kitSettingsRef = useLatest(kitSettings);

  // Held here rather than in the effect: a re-bind of the listeners between
  // two clicks would otherwise drop the double click.
  const clicksRef = useRef<ClickMemory>({ last: null });

  useToolLifecycle({
    entriesById,
    active: activeTool.active,
    hotkeyStack: activeTool.hotkeyStack,
    // The incoming tool must not inherit a live gesture.
    onSwitch: () => { for (const d of allDispatchers()) d.cancelAll('cancel'); },
  });

  useEffect(() => {
    if (enabled && claimKeys) registryRef.current.activate();
  }, [enabled, claimKeys, registryRef]);

  useEffect(() => {
    if (!enabled) return;
    return attachInput(canvasRef.current, {
      root: () => rootTargetRef.current,
      views: () => viewsRef.current,
      clientToLocal: () => clientToLocalRef.current,
      context: () => ctxRef.current,
      actions: () => registryRef.current,
      dispatchers: allDispatchers,
      requestRedraw: () => { requestRedrawRef.current?.(); },
      paintedCursor: () => cursorRef.current.painted?.(),
      cursorSink: () => cursorRef.current.sink?.(),
      longPress: () => longPressRef.current,
      kitSettings: () => kitSettingsRef.current,
      onClick: () => onClickRef.current,
      onDoubleClick: () => onDoubleClickRef.current,
      clicks: clicksRef.current,
      yieldKeys,
    }, {
      keyboard,
      pointer: pointerChannel,
      hover: hoverChannel,
      wheel: wheelChannel,
      pinch: pinchChannel,
      contextMenu: contextMenuChannel,
      ingest: ingestChannel,
      carry: carryChannel,
    });
  }, [enabled, keyboard, yieldKeys, canvasRef, pointerChannel, hoverChannel, wheelChannel, pinchChannel, contextMenuChannel, ingestChannel, carryChannel,
    allDispatchers, clientToLocalRef, ctxRef, kitSettingsRef, longPressRef, onClickRef, onDoubleClickRef, cursorRef, registryRef, requestRedrawRef, rootTargetRef, viewsRef]);
}
