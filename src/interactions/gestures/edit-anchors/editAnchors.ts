import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createTransformOp } from '../../../core/ops/transform';
import { dispatchApplyBatch } from '../../../core/applyOps';
import type { PolygonPath, Path } from '../../../features/paths/types';
import type { ModifierState } from '../types';
import type { Op } from '../../../core/ops/types';
import { hitAnchor, type AnchorHit } from './handles';
import { withCoord } from './geometry';

/** Adapter for `useEditAnchors` — narrow read/write of one object's path pose. */
export interface EditAnchorsAdapter<TObject extends { id: string }> {
  getObject(id: string): TObject | undefined;
  /** Must return a `Path`; only `kind === 'polygon'` is editable. */
  getPose(id: string): Path;
  setPose(id: string, pose: Path): void;
  applyBatch?: (ops: Op[], label?: string) => void;
}

/** Live overlay state for the anchor-edit pass. */
export interface EditAnchorsOverlay {
  id: string;
  pose: PolygonPath;
  selectedAnchors: number[];
  drag: { hit: AnchorHit } | null;
}

/** Arguments to `start()`. */
export interface EditAnchorsStartArgs {
  id: string;
  hit: AnchorHit;
  worldX: number;
  worldY: number;
}

/** Arguments to `move()`. */
export interface EditAnchorsMoveArgs {
  worldX: number;
  worldY: number;
  modifiers: ModifierState;
}

/** Options for `useEditAnchors`. */
export interface UseEditAnchorsOptions {
  /** World-space hit-test radius for anchor and control handles. Default 8. */
  hitRadius?: number;
  /** History label. Default `'Edit anchors'`. */
  editLabel?: string;
  /** Currently editing target — when non-null the controller draws an overlay
   *  and `tryHit` accepts hit-tests. */
  editingId?: string | null;
}

/** Return shape of `useEditAnchors`. */
export interface EditAnchorsController<TObject extends { id: string }> {
  start(args: EditAnchorsStartArgs): void;
  move(args: EditAnchorsMoveArgs): boolean;
  end(): void;
  cancel(): void;
  isActive(): boolean;
  overlay: EditAnchorsOverlay | null;
  tryHit(worldX: number, worldY: number): { id: string; hit: AnchorHit } | null;
  /** Clear the highlighted anchor selection (stays in edit mode). */
  clearSelection(): void;
  adapter: EditAnchorsAdapter<TObject>;
}

interface DragState {
  active: boolean;
  id: string | null;
  originPose: PolygonPath | null;
  hit: AnchorHit | null;
  current: PolygonPath | null;
}

export function useEditAnchors<TObject extends { id: string }>(
  adapter: EditAnchorsAdapter<TObject>,
  options: UseEditAnchorsOptions = {},
): EditAnchorsController<TObject> {
  const { hitRadius = 8, editLabel = 'Edit anchors', editingId = null } = options;

  const stateRef = useRef<DragState>({
    active: false,
    id: null,
    originPose: null,
    hit: null,
    current: null,
  });

  const [selectedAnchors, setSelectedAnchors] = useState<number[]>([]);
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  // Reset selection when editingId changes.
  useEffect(() => {
    setSelectedAnchors([]);
  }, [editingId]);

  const cleanup = useCallback(() => {
    stateRef.current = {
      active: false,
      id: null,
      originPose: null,
      hit: null,
      current: null,
    };
  }, []);

  const tryHit = useCallback(
    (worldX: number, worldY: number): { id: string; hit: AnchorHit } | null => {
      if (!editingId) return null;
      const pose = adapter.getPose(editingId);
      if (pose.kind !== 'polygon') return null;
      const hit = hitAnchor(pose, worldX, worldY, hitRadius);
      return hit ? { id: editingId, hit } : null;
    },
    [adapter, editingId, hitRadius],
  );

  const start = useCallback(
    (args: EditAnchorsStartArgs) => {
      const stored = adapter.getPose(args.id);
      if (stored.kind !== 'polygon') return;
      stateRef.current = {
        active: true,
        id: args.id,
        originPose: stored,
        hit: args.hit,
        current: stored,
      };
      setSelectedAnchors([args.hit.anchorIndex]);
      bump();
    },
    [adapter, bump],
  );

  const move = useCallback(
    (args: EditAnchorsMoveArgs): boolean => {
      const s = stateRef.current;
      if (!s.active || !s.id || !s.originPose || !s.hit) return false;
      // WHY: corner-only — drag mutates exactly one coord pair; adjacent
      //      controls stay in world space (smoothing deferred).
      s.current = withCoord(s.originPose, s.hit.coordIndex, args.worldX, args.worldY);
      bump();
      return true;
    },
    [bump],
  );

  const end = useCallback(() => {
    const s = stateRef.current;
    if (!s.active || !s.id || !s.originPose || !s.current) {
      cleanup();
      bump();
      return;
    }
    const { id, originPose, current } = s;
    cleanup();
    if (originPose === current) {
      bump();
      return;
    }
    const op = createTransformOp<Path>({ id, from: originPose, to: current, label: editLabel });
    dispatchApplyBatch(adapter, [op], editLabel);
    bump();
  }, [adapter, bump, cleanup, editLabel]);

  const cancel = useCallback(() => {
    cleanup();
    bump();
  }, [bump, cleanup]);

  const clearSelection = useCallback(() => {
    setSelectedAnchors([]);
  }, []);

  const overlay = useMemo<EditAnchorsOverlay | null>(() => {
    if (!editingId) return null;
    const stored = adapter.getPose(editingId);
    if (stored.kind !== 'polygon') return null;
    const s = stateRef.current;
    const live = s.active && s.current && s.id === editingId ? s.current : stored;
    return {
      id: editingId,
      pose: live,
      selectedAnchors,
      drag: s.active && s.hit ? { hit: s.hit } : null,
    };
    // tick triggers recompute on drag bump; adapter.getPose is queried each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, selectedAnchors, tick, adapter]);

  return {
    start,
    move,
    end,
    cancel,
    isActive: () => stateRef.current.active,
    overlay,
    tryHit,
    clearSelection,
    adapter,
  };
}
