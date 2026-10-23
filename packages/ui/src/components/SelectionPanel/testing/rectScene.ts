import {
  createScene,
  asNodeId,
  rotationDegreesUnit,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type SelectionApi,
} from '@weasel-js/core';

export interface Data { kind: string; fill?: string; label?: string }
export type Layer = 'default';
export interface Pose { x: number; y: number; width: number; height: number; rotation?: number }

export const routing: NodeRoutingEntry[] = [
  { name: 'rect', matches: (d) => (d as Data)?.kind === 'rect' },
  { name: 'text', matches: (d) => (d as Data)?.kind === 'text' },
];

export const properties: NodePropertiesEntry[] = [
  {
    name: 'rect',
    schema: {
      name: 'Properties',
      members: {
        layout: {
          name: 'Layout',
          members: {
            'pose.x': { kind: 'number', name: 'X', description: 'x', default: 0, pair: { with: 'pose.y', label: 'Position' } },
            'pose.y': { kind: 'number', name: 'Y', description: 'y', default: 0 },
            'pose.rotation': { kind: 'number', name: 'Rotation', description: 'r', default: 0, unit: rotationDegreesUnit },
          },
        },
        appearance: {
          name: 'Appearance',
          members: {
            'data.fill': { kind: 'color', name: 'Fill', description: 'f', default: '#000000ff', alpha: true },
            'data.label': { kind: 'string', name: 'Label', description: 'l', default: '' },
          },
        },
      },
    },
  },
];

export function makeScene() {
  const scene = createScene<Data, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: { x: 10, y: 20, width: 30, height: 40, rotation: Math.PI / 4 }, data: { kind: 'rect', fill: '#ff0000ff', label: 'hello' } });
  scene.add({ id: asNodeId('b'), kind: 'mark', layer: 'default', pose: { x: 50, y: 20, width: 30, height: 40 }, data: { kind: 'rect', fill: '#00ff00ff' } });
  return scene;
}

export const selectionOf = (ids: string[]): SelectionApi =>
  ({ current: ids } as unknown as SelectionApi);
