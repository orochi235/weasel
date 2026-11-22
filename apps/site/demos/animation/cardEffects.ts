import { useEffect, type RefObject } from 'react';
import { asNodeId, type NodeId } from '@weasel-js/core';

export interface CardEffect { scale: number; alpha: number }

/** Drops a card's entry from `effects` once the scene no longer holds the card. */
export function usePruneCardEffects(
  scene: { subscribe(fn: () => void): () => void; get(id: NodeId): unknown },
  effects: RefObject<Map<string, CardEffect>>,
): void {
  useEffect(() => scene.subscribe(() => {
    for (const id of effects.current.keys()) {
      if (!scene.get(asNodeId(id))) effects.current.delete(id);
    }
  }), [scene, effects]);
}
