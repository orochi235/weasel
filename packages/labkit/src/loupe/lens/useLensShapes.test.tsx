import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { nodeShapesOf } from '@weasel-js/core';
import { createLensScene } from './lensScene';
import { useLensShapes } from './useLensShapes';

const scene = createLensScene<string>();
const redraw = () => {};
const setLayer = () => {};

function Layer() {
  const attach = useLensShapes(scene, redraw, setLayer);
  return <div ref={attach} data-testid="layer" />;
}

function rimColor(): unknown {
  const body = nodeShapesOf(scene).entries().find((e) => e.id === 'labkit:lens-body');
  const cmds = body?.paint(
    { data: { role: 'lens-body', shape: 'circle' } } as never,
    { x: 0, y: 0, width: 10, height: 10 } as never,
  ) as { stroke: { paint: { color: string } } }[];
  return cmds[0]?.stroke.paint.color;
}

describe('useLensShapes', () => {
  it('draws lenses in the accent the theme sets after a mode switch', async () => {
    const { getByTestId } = render(<Layer />);
    const layer = getByTestId('layer');
    layer.style.setProperty('--wzl-accent', '#111111');
    layer.setAttribute('data-wzl-mode', 'dark');
    await act(async () => void (await new Promise((r) => setTimeout(r, 0))));
    expect(rimColor()).toBe('#111111');

    layer.style.setProperty('--wzl-accent', '#222222');
    layer.setAttribute('data-wzl-mode', 'light');
    await act(async () => void (await new Promise((r) => setTimeout(r, 0))));
    expect(rimColor()).toBe('#222222');
  });
});
