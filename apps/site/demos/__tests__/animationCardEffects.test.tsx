import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { asNodeId, useScene } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { usePruneCardEffects, type CardEffect } from '../animation/cardEffects';

interface Card { id: string; x: number; y: number; width: number; height: number }

describe('usePruneCardEffects', () => {
  it('drops a card’s effect once the scene removes the card', () => {
    const { result } = renderHook(() => {
      const scene = useScene<Card>({ items: [] });
      const effects = useRef(new Map<string, CardEffect>());
      usePruneCardEffects(scene, effects);
      return { scene, effects };
    });
    const { scene, effects } = result.current;
    act(() => {
      for (const id of ['n1', 'n2']) {
        effects.current.set(id, { scale: 1, alpha: 0.3 });
        const card = { id, x: 0, y: 0, width: 10, height: 10 };
        scene.add({ id: asNodeId(id), kind: 'mark', layer: 'default', pose: card, data: card });
      }
    });
    act(() => { scene.remove(asNodeId('n1')); });
    expect([...effects.current.keys()]).toEqual(['n2']);
  });
});
