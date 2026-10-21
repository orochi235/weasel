/**
 * What a host hands `useGestureDispatcher`: the canvas, its registries, the
 * hit-test thunks, and, for a surface with several views, how each is routed.
 */
import type { RefObject } from 'react';
import type { BodyClassification } from '@weasel-js/gestures';
import type { CursorSink, PaintedCursorState } from '@weasel-js/cursor';
import type { Contribution } from '../../contributions/types';
import type { DepSchema } from '../../index';
import type { AffordanceHit } from '../actions/invoker';
import type { ActionsRegistry } from '../actions/registry';
import type { Dispatcher } from './dispatcherApi';
import type { DispatchTrace } from './dispatchTrace';
import type { LongPressOptions } from './longPressState';

/**
 * Everything about handling an input event that depends on *which view* it
 * landed in: the dispatcher that runs it, and the three lookups that resolve
 * a client point against that view's camera.
 *
 * @internal One per view. The hook builds the `id: null` one from its flat
 *   options; `views` supplies the rest, and the hook chooses between them per
 *   event, so that it — and its listener set — still mounts exactly once.
 */
export interface DispatcherViewTarget {
  /** `null` is the root view — the whole canvas. Matches `ViewTarget.id`. */
  id: string | null;
  dispatcher: Dispatcher;
  affordanceAt: UseGestureDispatcherOptions['affordanceAt'];
  classifyTarget: UseGestureDispatcherOptions['classifyTarget'];
  clientToWorld: UseGestureDispatcherOptions['clientToWorld'];
  /**
   * The deps this view answers for itself — its camera, its selection, and
   * whatever else is per-view rather than per-canvas. Read per event; every
   * name it does not carry still resolves through the canvas registry.
   * Without this a gesture inside a panel pans the whole canvas and selects
   * into the canvas's selection.
   *
   * A view gets no `DepRegistryProvider` of its own: a consumer overriding
   * `insert` would have to know how many views exist and override each.
   */
  deps?: () => Partial<DepSchema>;
  /**
   * This view's chrome-caps rule context, for the eligibility filter. The rule
   * table is the surface's, but a rule keyed on selection or the in-flight
   * action answers per view — so an action hidden in one panel must not
   * decline a gesture in another. `undefined` means "nothing gates here", the
   * same answer a surface with no mode registry gives.
   */
  getRuleCtx?: () => import('../../eligibility').RuleCtx | undefined;
}


/**
 * The part of `features/viewports`' `ViewResolver` the dispatcher needs: which
 * view a client point belongs to, pinned to the view a gesture began in.
 *
 * @internal Structural on purpose — a `ViewResolver` satisfies it, and the
 *   dispatcher stays free of the viewport module.
 */
export interface ViewIdResolver {
  begin(pointerId: number, clientX: number, clientY: number): { id: string | null };
  at(pointerId: number | null, clientX: number, clientY: number): { id: string | null };
  end(pointerId: number): void;
}

/** Per-channel switches for the listeners `useGestureDispatcher` attaches to
 *  the canvas element. Omitted or `true` attaches the channel. */
export interface DispatcherChannels {
  /** `pointerdown`, hover `pointermove`, `pointerleave` — press, drag, click,
   *  long-press, multi-touch and the hover-cursor pump. */
  pointer?: boolean;
  /** `hover` gestures and the hover-cursor pump without the rest of
   *  `pointer`: no press opens a gesture or captures the pointer, so the
   *  element's own clicks and drags are left alone. Omitted, it follows
   *  `pointer`, which carries hovers whenever it is on. */
  hover?: boolean;
  /** `wheel`. */
  wheel?: boolean;
  /** WebKit's `gesturestart` / `gesturechange` / `gestureend` — Safari's
   *  trackpad pinch, dispatched as `pinch` events. */
  pinch?: boolean;
  /** `contextmenu`. Off leaves the browser's native menu in place. */
  contextMenu?: boolean;
  /** OS drop on the element plus `paste` on the window. Off leaves the
   *  element a non-drop-target and stops `weasel-dropover` being applied. */
  ingest?: boolean;
  /** A carry (`startCarry`) from elsewhere on the page, over the element. Off,
   *  the element is not a surface a carry can be released on. */
  carry?: boolean;
}

/** Options for `useGestureDispatcher`: the element to listen on, the actions
 *  and entries in play, and the hooks that turn raw DOM events into the world
 *  coordinates and hit targets bindings match against. */
export interface UseGestureDispatcherOptions {
  /**
   * Take the keyboard on mount, as a press in the canvas would. Keys that
   * reach the page go to the canvas last pressed or scrolled in and to none
   * before that; an app whose canvas is the page sets this so its shortcuts
   * work before the first click. Default `false`.
   */
  claimKeys?: boolean;
  /** Ref to the canvas element. Pointer/wheel/multitouch listeners attach here. */
  canvasRef: RefObject<HTMLElement | null>;
  /** Action registry (ActionsRegistry from registry.tsx). */
  actions: ActionsRegistry;
  /**
   * Which actions this dispatcher matches. `'scope'` (default): every action a
   * read from `actions` reaches, down its active scope. `'own'`: only those
   * registered at `actions`' own node — for chrome on a root that canvases
   * nest under.
   */
  hears?: 'scope' | 'own';
  /** Every entry in play, keyed by id: tools and any other contribution
   *  whose bindings this dispatcher routes. */
  entriesById: ReadonlyMap<string, Contribution<unknown>>;
  /** Default true. Set false to opt out of dispatcher wiring (e.g. demos that disable it). */
  enabled?: boolean;
  /**
   * Observer fired whenever the dispatcher synthesizes a double click, in
   * world coordinates. Runs BEFORE the event is dispatched and independently
   * of which binding (if any) handles it.
   *
   * Deliberately not an Action: a notification must not compete with behavior
   * for the gesture. As a binding it would lose to `enterPathEdit` on any
   * body hit and silently never fire.
   */
  onDoubleClick?: (world: { x: number; y: number }) => void;
  /**
   * Observer fired on every synthesized click, in world coordinates — an
   * observer for the same reason as `onDoubleClick`. Unlike it, this runs
   * AFTER the click is dispatched, so whatever the click's binding changed
   * (a pick, say) is already readable.
   */
  onClick?: (world: { x: number; y: number }) => void;
  /**
   * Default true. Set false to leave the window `keydown`/`keyup` listeners
   * unattached so keyboard-bound actions never dispatch — pointer, wheel, and
   * contextmenu channels stay live. `<SceneCanvas>` wires this to
   * `enableKeybindings`.
   *
   * Every dispatcher hears keys on `window`, and a keystroke one of them
   * claims — or anything else calls `preventDefault` on — is not dispatched by
   * the rest. `'first'` listens in the capture phase, so this dispatcher gets
   * the keystroke ahead of every dispatcher listening normally, whatever the
   * mount order: the shape for chrome that owns a key only when it can act.
   */
  keyboard?: boolean | 'first';
  /**
   * Optional affordance classifier. Called with the **world** coordinates of
   * the pointer — this hook applies the routed view's `clientToWorld` before
   * calling it, so a consumer hit-tests in one space. Returns an
   * `AffordanceHit` when the pointer lands on a known affordance (resize
   * handle, rotate handle, etc.) or `null` when the pointer hit open canvas.
   *
   * The hit is packed into `InputEvent.pointerdown.affordance` and flows
   * through into `InvocationCtx.drag.affordance`. When omitted, `affordance`
   * is always `undefined`. `<SceneCanvas>` wires the full chrome→dispatcher
   * bridge.
   */
  affordanceAt?: (worldPoint: { x: number; y: number }) => AffordanceHit | null;

  /**
   * Optional body classifier. Called on every pointerdown with the world-space
   * coordinates of the pointer. Its result is packed onto the event as
   * `bodyTarget` + `bodyKind`, which `matchTarget` reads to resolve the
   * string-form `TargetSpec` values in `Tool.bindings`.
   *
   * When omitted, every body-derived target form (`'empty'`,
   * `'selected-body'`, `'unselected-body'`, `kind:<k>`, `kind:<k>:selected`)
   * never matches — bindings using those specs are silently skipped.
   * `<SceneCanvas>` wires this.
   */
  classifyTarget?: (worldPoint: { x: number; y: number }) => BodyClassification;

  /**
   * Optional pre-created `Dispatcher`. When provided, this hook pumps events
   * into the supplied instance instead of creating its own. Lets a parent
   * scope (e.g. `<SceneCanvas>`) share one dispatcher between the gesture
   * mounter and other consumers (the preview-ghost layer).
   */
  dispatcher?: Dispatcher;

  /** Where every dispatcher this hook drives records its decisions. Absent,
   *  the hook makes one of its own. Published as the `dispatchTrace` dep. */
  trace?: DispatchTrace;

  /**
   * Converts a client-space pointer position (e.g. `e.clientX`, `e.clientY`)
   * to world-space coordinates. When supplied, every pointer/wheel event's
   * `x`/`y` is converted before the dispatcher builds `InvocationCtx.world`.
   *
   * Without this, `ctx.world` is populated with the raw client coords, which
   * silently breaks any action whose overlay/output uses absolute world
   * positions (marquee, lasso polyline, world-space affordances).
   * `<SceneCanvas>` always wires this via its canvas rect + current view.
   */
  clientToWorld?: (clientX: number, clientY: number) => { x: number; y: number };

  /**
   * Converts a client point to CSS pixels from the canvas's top-left: where
   * the painted cursor draws, where a wheel or pinch zoom anchors, and where a
   * pending long-press is published. Without this, the element's rect is
   * subtracted — wrong for a canvas under a CSS transform, whose host already
   * owns the mapping. `<SceneCanvas>` wires it from its own camera, so a
   * `clientToWorld` override reaches it.
   */
  clientToLocal?: (clientX: number, clientY: number) => { x: number; y: number };

  /**
   * Called whenever one of this hook's dispatchers notifies its subscribers:
   * once for each input event, cancel, or UI-driven step that found or left a
   * gesture in flight. Lets the host canvas schedule a redraw, so
   * dispatcher-only overlays (marquee, lasso, preview-ghost) follow the
   * gesture and clear when it ends, however it ends. `<SceneCanvas>` wires
   * this to the canvas's `requestRedraw`.
   */
  requestRedraw?: () => void;
  /**
   * The surface's painted-cursor channel, read live because the canvas handle
   * it lives on arrives a render after this hook runs.
   *
   * Given one, a cursor the CSS tier cannot express — sized in world units, or
   * past the size the browser drops the image at — is published here and drawn
   * by the painted-cursor layer instead. Without one, such a cursor resolves to
   * `none` and the pointer shows nothing.
   */
  paintedCursor?: () => PaintedCursorState | undefined;

  /**
   * Where the hover cursor is written, read live like `paintedCursor`. A
   * surface that shows a tool cursor of its own passes the sink that holds
   * it, so a hover cursor that clears puts the tool's back. Without one the
   * dispatcher writes the canvas element's `cursor` style and removes what
   * it wrote.
   */
  cursorSink?: () => CursorSink | undefined;

  /** How touch and pen long-presses are timed, published and felt. */
  longPress?: LongPressOptions;

  /**
   * Thunk returning the live `RuleCtx` for the current frame. When supplied,
   * the dispatcher filters matched candidates by their declared
   * `Action.eligible` rule (omitted => always eligible). `<SceneCanvas>`
   * wires this; tests / harnesses without chrome-caps state can omit it.
   */
  getRuleCtx?: () => import('../../eligibility').RuleCtx | undefined;

  /**
   * Which of the canvas element's input channels to attach. Every one
   * defaults to `true`; naming a channel `false` leaves its listeners
   * unattached, so the element behaves as if the dispatcher were not there.
   *
   * `contextMenu` suppresses the native menu unconditionally, and `ingest`
   * hears every paste on the window and probes the bindings on each
   * `dragover`, so a mount that binds only a wheel or a key turns those off
   * to keep right-click and file drops working.
   *
   * The window keyboard channel is `keyboard` instead of an entry here,
   * because `<SceneCanvas enableKeybindings>` drives it.
   */
  channels?: DispatcherChannels;

  /**
   * Routing for a canvas hosting more than one view: the non-root dispatch
   * records to choose between, read fresh per event, and the resolver that
   * chooses. Omit for a single view — then every event runs on the record the
   * flat options above describe, which is what they are: view zero.
   *
   * A resolved id with no live record falls back to the root, so a view that
   * unmounts mid-gesture degrades instead of dropping the event.
   *
   * Keyboard and paste have no coordinates to resolve; they run on the view
   * the last coordinate-bearing event resolved to.
   *
   * @internal
   */
  views?: {
    targets: () => readonly DispatcherViewTarget[];
    resolver: ViewIdResolver;
  };
}
