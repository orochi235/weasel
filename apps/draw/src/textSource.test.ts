import { describe, expect, it } from 'vitest';
import { asNodeId, createScene } from '@weasel-js/core';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { textSourceOf } from './booleansAdapter';

function sourceOf(data: WeaselDrawData) {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('t'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 200, height: 100 }, data });
  return textSourceOf(scene, 't');
}

describe('textSourceOf', () => {
  it('hands outline extraction the box a padded note sets its text in', () => {
    expect(sourceOf({ text: 'hi', padding: 10 })!.pose).toEqual({ x: 10, y: 10, width: 180, height: 80 });
  });

  it('carries a fit, so the outlines are set at the size the text is painted at', () => {
    expect(sourceOf({ text: 'hi', fit: 'shrink' })!.data.fit).toBe('shrink');
  });
});
