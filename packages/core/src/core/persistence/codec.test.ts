import { describe, expect, it } from 'vitest';
import { asPolygonPath, rectPath } from '@weasel-js/geom';
import { createScene, sceneFromJSON } from '../scene';
import { decodeSnapshot, encodeSnapshot, parseSnapshot, stringifySnapshot } from './codec';

type Pose = { x: number; y: number; width: number; height: number };

/** Through text, as a file or `localStorage` keeps it. */
const viaText = <T>(value: T): unknown => JSON.parse(JSON.stringify(value));

function drawn() {
  const scene = createScene<Record<string, unknown>, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { path: asPolygonPath(rectPath(0, 0, 10, 10)) } });
  return { scene };
}

describe('the snapshot codec', () => {
  it('round-trips typed-array geometry that plain JSON corrupts', () => {
    const { scene } = drawn();
    const plain = JSON.parse(JSON.stringify(scene.toJSON())) as ReturnType<typeof scene.toJSON>;
    expect(ArrayBuffer.isView((plain.nodes[0]!.data as { path: { coords: unknown } }).path.coords)).toBe(false);
    const back = parseSnapshot(stringifySnapshot(scene.toJSON()));
    expect(back).toEqual(scene.toJSON());
    const loaded = sceneFromJSON(back);
    const coords = (loaded.toJSON().nodes[0]!.data as { path: { coords: Float32Array } }).path.coords;
    expect(coords).toBeInstanceOf(Float32Array);
  });

  it('keeps a value shaped like its own tags as the value it was', () => {
    const data = { lookalike: { __ta: 'u8', data: [1, 2] }, wrapper: { __raw: 3 }, commands: [1, 2] };
    expect(decodeSnapshot(viaText(encodeSnapshot(data)))).toEqual(data);
  });

  it("reads a path's untagged arrays as an older save wrote them", () => {
    const old = { path: { commands: [0, 1, 4], coords: { 0: 1, 1: 2 } } };
    const read = decodeSnapshot(old) as { path: { commands: Uint8Array; coords: Float32Array } };
    expect(read.path.commands).toEqual(Uint8Array.from([0, 1, 4]));
    expect(read.path.coords).toEqual(Float32Array.from([1, 2]));
  });

  it('leaves the value it decodes as it was', () => {
    const encoded = viaText(encodeSnapshot({ a: new Uint8Array([1]) }));
    const before = JSON.stringify(encoded);
    decodeSnapshot(encoded);
    expect(JSON.stringify(encoded)).toBe(before);
  });

  it('revives a typed array under any key, not only a path\'s', () => {
    const data = { weights: new Float32Array([0.25, 0.75]), nested: [{ ids: new Uint8Array([3, 4]) }] };
    const revived = parseSnapshot(stringifySnapshot(data));
    expect(revived.weights).toBeInstanceOf(Float32Array);
    expect(revived).toEqual(data);
  });

  it('leaves a commands or coords field that holds no numbers as it is', () => {
    const data = { commands: ['undo', 'redo'], coords: { lat: 51.5, lng: -0.1 }, nested: { coords: [[1, 2], [3, 4]] } };
    expect(parseSnapshot(stringifySnapshot(data))).toEqual(data);
  });
});
