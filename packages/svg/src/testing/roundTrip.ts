/**
 * Golden round-trip tests: for each fixture, assert that
 * `parseSvg(serializeSvg(parseSvg(svg).nodes)).nodes` deep-equals
 * `parseSvg(svg).nodes`. The intermediate SVG bytes don't have to match
 * the input — only the parsed shape must round-trip.
 *
 * Floats are rounded to 3 decimals during normalization so that the
 * trimNumber serializer (6 decimals) plus the arc→cubic conversion
 * (transcendental math) don't trip equality.
 */

import { parseSvg, serializeSvg, type SvgNode } from '../index';
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
}

export interface NormalizedGroup {
  kind: 'group';
  children: NormalizedNode[];
  transform?: number[];
  clip?: { commands: number[]; coords: number[] };
  opacity?: number;
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
}

export type NormalizedNode = NormalizedPath | NormalizedGroup | NormalizedText | NormalizedImage;

export function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** A bare outline — a clip carries no paint, so only its geometry matters. */
function normalizeOutline(path: Path): { commands: number[]; coords: number[] } {
  if (path.kind === 'rect') {
    return {
      commands: [0, 1, 1, 1, 4],
      coords: [
        path.x, path.y,
        path.x + path.width, path.y,
        path.x + path.width, path.y + path.height,
        path.x, path.y + path.height,
      ].map(round),
    };
  }
  return {
    commands: Array.from(path.commands as Uint8Array),
    coords: Array.from(path.coords as Float32Array).map(round),
  };
}

function normalize(node: SvgNode): NormalizedNode {
  if (node.kind === 'group') {
    const out: NormalizedGroup = {
      kind: 'group',
      children: node.children.map(normalize),
    };
    if (node.transform) out.transform = Array.from(node.transform).map(round);
    if (node.clip) out.clip = normalizeOutline(node.clip);
    if (node.opacity != null) out.opacity = round(node.opacity);
    return out;
  }
  if (node.kind === 'text') {
    const out: NormalizedText = {
      kind: 'text',
      x: round(node.x),
      y: round(node.y),
      width: round(node.width),
      height: round(node.height),
      text: node.text,
    };
    if (node.runs) out.runs = node.runs;
    if (node.style) out.style = node.style;
    if (node.opacity != null) out.opacity = round(node.opacity);
    return out;
  }
  if (node.kind === 'image') {
    const out: NormalizedImage = {
      kind: 'image',
      href: node.href,
      x: round(node.x),
      y: round(node.y),
      width: round(node.width),
      height: round(node.height),
    };
    if (node.opacity != null) out.opacity = round(node.opacity);
    if (node.rotation != null) out.rotation = round(node.rotation);
    return out;
  }
  const path = node.path;
  let commands: number[];
  let coords: number[];
  let fillRule: string;
  if (path.kind === 'rect') {
    // M h v h Z lowering — matches what the serializer emits for rects.
    commands = [0, 1, 1, 1, 4]; // PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z
    coords = [
      path.x, path.y,
      path.x + path.width, path.y,
      path.x + path.width, path.y + path.height,
      path.x, path.y + path.height,
    ].map(round);
    fillRule = 'nonzero';
  } else {
    commands = Array.from(path.commands as Uint8Array);
    coords = Array.from(path.coords as Float32Array).map(round);
    fillRule = path.fillRule;
  }
  const norm: NormalizedPath = {
    kind: 'path',
    commands,
    coords,
    fillRule,
    fill: node.fill,
  };
  if (node.stroke) norm.stroke = node.stroke;
  if (node.opacity != null) norm.opacity = round(node.opacity);
  return norm;
}

function normalizeAll(nodes: SvgNode[]): NormalizedNode[] {
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
