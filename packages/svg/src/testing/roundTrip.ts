/**
 * Golden round-trip tests: for each fixture, assert that
 * `parseSvg(serializeSvg(parseSvg(svg).nodes)).nodes` deep-equals
 * `parseSvg(svg).nodes`. The intermediate SVG bytes don't have to match
 * the input — only the parsed shape must round-trip.
 *
 * Every field a node carries is compared, with geometry in world coordinates.
 * Floats are rounded to 3 decimals during normalization so that the
 * trimNumber serializer (6 decimals) plus the arc→cubic conversion
 * (transcendental math) don't trip equality.
 */

import { parseSvg, serializeSvg, type SvgNode } from '../index';
import { worldCoords } from '@weasel-js/geom';
import type { Path } from '@weasel-js/core';

export interface NormalizedPath {
  kind: 'path';
  /**
   * RectPath and the equivalent 4-line PolygonPath collapse to the same
   * `polygon` shape during normalization — the data model treats them
   * interchangeably and the SVG serializer always lowers rects to
   * `<path d="M h v h Z">`, which parses back as a polygon.
   */
  commands: number[];
  coords: number[];
  fillRule: string;
  fill: unknown;
  stroke?: unknown;
  opacity?: number;
  [field: string]: unknown;
}

export interface NormalizedGroup {
  kind: 'group';
  children: NormalizedNode[];
  transform?: number[];
  clip?: { commands: number[]; coords: number[] };
  opacity?: number;
  [field: string]: unknown;
}

export interface NormalizedText {
  kind: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  runs?: unknown;
  style?: unknown;
  opacity?: number;
  [field: string]: unknown;
}

export interface NormalizedImage {
  kind: 'image';
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  rotation?: number;
  [field: string]: unknown;
}

export type NormalizedNode = NormalizedPath | NormalizedGroup | NormalizedText | NormalizedImage;

export function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** `v` with every number rounded and every typed array made a plain one, so floats compare loosely. */
function roundDeep(v: unknown): unknown {
  if (typeof v === 'number') return round(v);
  if (ArrayBuffer.isView(v)) return Array.from(v as unknown as ArrayLike<number>, round);
  if (Array.isArray(v)) return v.map(roundDeep);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, roundDeep(x)]));
  }
  return v;
}

/** A bare outline in world coordinates: a polygon's `coords` are measured from its `origin`. */
function normalizeOutline(path: Path): { commands: number[]; coords: number[]; fillRule: string } {
  if (path.kind === 'rect') {
    // M h v h Z lowering — matches what the serializer emits for rects.
    return {
      commands: [0, 1, 1, 1, 4], // PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z
      coords: [
        path.x, path.y,
        path.x + path.width, path.y,
        path.x + path.width, path.y + path.height,
        path.x, path.y + path.height,
      ].map(round),
      fillRule: 'nonzero',
    };
  }
  return {
    commands: Array.from(path.commands as Uint8Array),
    coords: Array.from(worldCoords(path), round),
    fillRule: path.fillRule,
  };
}

/** Every field the node carries, its geometry in world coordinates and its numbers rounded. */
function normalize(node: SvgNode): NormalizedNode {
  if (node.kind === 'group') {
    const { children, clip, ...rest } = node;
    return {
      ...(roundDeep(rest) as Omit<NormalizedGroup, 'children'>),
      children: children.map(normalize),
      ...(clip ? { clip: normalizeOutline(clip) } : {}),
    } as NormalizedGroup;
  }
  if (node.kind === 'path') {
    const { path, ...rest } = node;
    return { ...(roundDeep(rest) as Omit<NormalizedPath, 'commands' | 'coords' | 'fillRule'>), ...normalizeOutline(path) } as NormalizedPath;
  }
  return roundDeep(node) as NormalizedNode;
}

export function normalizeAll(nodes: SvgNode[]): NormalizedNode[] {
  return nodes.map(normalize);
}

export function roundTrip(svg: string): { a: NormalizedNode[]; b: NormalizedNode[]; warnings: string[] } {
  const first = parseSvg(svg);
  const out = serializeSvg(first.nodes);
  const second = parseSvg(out);
  return {
    a: normalizeAll(first.nodes),
    b: normalizeAll(second.nodes),
    warnings: [...first.warnings, ...second.warnings],
  };
}
