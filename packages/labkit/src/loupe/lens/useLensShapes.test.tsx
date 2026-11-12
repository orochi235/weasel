import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLensScene } from './lensScene';
import { useLensShapes } from './useLensShapes';

const registered = vi.hoisted(() => [] as { id: string; paint: (...a: never[]) => unknown }[]);
vi.mock('@weasel-js/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weasel-js/core')>();
  return {
    ...actual,
    registerNodeShape: (entry: { id: string; paint: (...a: never[]) => unknown }) => {
      registered.push(entry);
      return () => registered.splice(registered.indexOf(entry), 1);
    },
  };
});

const scene = createLensScene<string>();
const redraw = () => {};
const setLayer = () => {};

function Layer() {
  const attach = useLensShapes(scene, redraw, setLayer);
  return <div ref={attach} data-testid="layer" />;
}

function rimColor(): unknown {
  const body = registered.find((e) => e.id === 'labkit:lens-body');
  const cmds = body?.paint(
    { data: { role: 'lens-body', shape: 'circle' } } as never,
    { x: 0, y: 0, width: 10, height: 10 } as never,
  ) as { stroke: { paint: { color: string } } }[];
  return cmds[0]?.stroke.paint.color;
}

afterEach(() => {
  registered.length = 0;
});

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
