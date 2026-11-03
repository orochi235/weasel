/**
 * A label scene through real WebGL2: printed at one pixel per dot over the printable band, and
 * written as an `.lbx` whose rect stays an object while the ellipse beside it becomes an image.
 */
import { describe, expect, it } from 'vitest';
import { createScene, type DrawCommand } from '@weasel-js/core';
import { ellipsePath } from '@weasel-js/geom';
import { parseLbx, type ImageObject, type RectObject } from 'bil-lbx';
import type { RectPose } from 'core/scene/composePose';
import { lbxObjects, Printers, renderLabel, sceneToLbx, tapeForWidthMm } from '@weasel-js/p-touch';

const tape = tapeForWidthMm(12)!;
const media = Printers.ptP710bt.media(12);

function labelScene() {
  const scene = createScene<{ cmd: DrawCommand }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const add = (cmd: DrawCommand) => scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 72, height: tape.widthPt }, data: { cmd } });
  add({ kind: 'path', path: { kind: 'rect', x: 4, y: 8, width: 20, height: 16 }, fill: { paint: { color: '#000000' } } });
  add({ kind: 'path', path: ellipsePath({ x: 40, y: 8, width: 24, height: 16 }), fill: { paint: { color: '#000000' } } });
  return scene;
}
const drawOne = (node: { data: { cmd: DrawCommand } }) => [node.data.cmd];

describe('renderLabel', () => {
  it('renders the printable band at one pixel per dot, ink where the label has it', async () => {
    const img = await renderLabel({ scene: labelScene(), drawOne, length: 72, tape, media });
    expect(img.width).toBe(180);
    expect(img.height).toBe(media.printableDots);
    const bandTop = (tape.widthPt - media.printableDots * 0.4) / 2;
    const at = (xPt: number, yPt: number) => img.data[(Math.round((yPt - bandTop) * 2.5) * img.width + Math.round(xPt * 2.5)) * 4];
    expect(at(14, 16)).toBe(0);
    expect(at(30, 16)).toBe(255);
    expect(at(52, 16)).toBe(0);
  });
});

describe('sceneToLbx', () => {
  it('keeps the rect an object and places the ellipse as an image over its bounds', async () => {
    const { bytes, skipped } = await sceneToLbx({ scene: labelScene(), drawOne, length: 72, tape });
    expect(skipped).toEqual([]);
    const back = await parseLbx(bytes);
    expect(back.objects.map((o) => o.type)).toEqual(['rect', 'image']);
    expect((back.objects[0] as RectObject).position).toMatchObject({ x: 4, y: 8, width: 20, height: 16 });
    const image = back.objects[1] as ImageObject;
    expect(image.position.x).toBeGreaterThan(39);
    expect(image.position.x + image.position.width).toBeLessThan(65);
    expect(image.position.height).toBeGreaterThan(15);
    expect(image.position.height).toBeLessThan(17.5);
  });

  it('writes what a drawOne carries with lbxObjects as that object, through the scene walk', async () => {
    const scene = labelScene();
    const barcode = { type: 'barcode' as const, protocol: 'QRCODE' as const, data: 'weasel', position: { x: 0, y: 0, width: 20, height: 20 } };
    scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 72, height: tape.widthPt }, data: { cmd: lbxObjects([barcode]) } });
    const { bytes } = await sceneToLbx({ scene, drawOne, length: 72, tape, origin: { x: 0, y: -2 } });
    const back = await parseLbx(bytes);
    expect(back.objects.map((o) => o.type)).toEqual(['rect', 'image', 'barcode']);
    expect(back.objects[2]!.position).toMatchObject({ x: 0, y: 2, width: 20, height: 20 });
  });
});
