/**
 * Kit-standard DepSchema augmentation (Phase 4 of registry unification).
 *
 * Adds the named entries the kit's default actions consume. Consumer apps
 * add their own entries (e.g. `color`) via the same declaration-merging
 * pattern in their own files.
 *
 * Side-effect import: importing this file augments the shared DepSchema
 * type. Re-exported from `src/index.ts` so consumers get the entries
 * automatically.
 *
 * ## Improvisation notes
 *
 * - **`view`**: No `ViewApi` interface existed. A minimal `{ get(): View;
 *   set(v: View): void }` is defined here; Phase 5+ may refine to include
 *   animation helpers or fit-to-bounds.
 *
 * - **`scene`**: `Scene<TData, TLayer, TPose>` is a generic interface with no
 *   canonical "erased" alias. We use `Scene<unknown, string, unknown>` as the
 *   dep-schema entry; actions that need a typed scene should narrow at the
 *   call site. A future phase may introduce a `SceneApi` alias once the common
 *   subset stabilises.
 *
 * - **`pointer`**: `PointerContextValue` is marked `@experimental` upstream.
 *   Registered here as-is; if the contract changes, update this import and
 *   the augmentation below.
 *
 * @see docs/superpowers/specs/2026-05-16-registry-unification-design.md
 */

import type { SelectionApi } from 'core/selection/useSelection';
import type { View } from 'core/viewport/view';
import type { Scene } from 'core/scene/types';
import type { History } from 'core/history/history';
import type { PointerContextValue } from 'features/pointer/PointerContext';
import type { ActiveToolContextValue } from './activeToolContext';

/** Minimal view API the action layer consumes. Phase 5+ may refine. */
export interface ViewApi {
  get(): View;
  set(v: View): void;
}

declare module './depRegistry' {
  interface DepSchema {
    /** Kit selection state — ids of currently selected nodes. */
    selection: SelectionApi;
    /** Current viewport — camera position + scale. */
    view: ViewApi;
    /**
     * Scene tree — structural reads + undoable mutations.
     *
     * The entry uses the fully-erased form `Scene<unknown, string, unknown>`
     * because `DepSchema` must be concrete. Actions that need a typed scene
     * should cast: `deps.scene as Scene<MyData, MyLayer, MyPose>`.
     */
    scene: Scene<unknown, string, unknown>;
    /** Undo/redo history bound to the current scene. */
    history: History;
    /**
     * Canvas pointer position in world space.
     *
     * Exposes `pointerRef` (mutable live ref) and `getDropPoint()` thunk.
     * Marked `@experimental` in the source.
     */
    pointer: PointerContextValue;
    /** Currently active tool id + hotkey-hold stack. */
    activeTool: ActiveToolContextValue;
  }
}

export {};
