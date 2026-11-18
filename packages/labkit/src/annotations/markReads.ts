import { asNodeId } from '@weasel-js/core';
import { fromShape, roundFrac, roundPoints, worldToFrac } from './frac';
import { markIdOf, splitMarkId } from './markId';
import type { MarkPose, MarkScene } from './markScenes';
import type { Annotation, AnnotationTargetInfo } from './types';

type Content = { width: number; height: number };

/** What the read side needs: the scenes, and where each target is. */
export interface MarkReadsOptions {
  scenes: ReadonlyMap<string, MarkScene>;
  targets: () => readonly AnnotationTargetInfo[];
  contentOf: (target: string) => Content;
}

/** A scene node found behind a public mark id. */
export interface FoundMark {
  target: string;
  node: NonNullable<ReturnType<MarkScene['get']>>;
  scene: MarkScene;
}

/** The store's answers about its scenes, in fractions of a target's content box. */
export interface MarkReads {
  /** One mark as the public `Annotation`, or undefined. */
  project(target: string, node: string): Annotation | undefined;
  /** A target's marks in paint order. */
  marksOn(target: string): Annotation[];
  /** Every mark on every live target. */
  all(): Annotation[];
  /** Every target with a scene, in declaration order, then any whose target
   *  the instrument has since stopped declaring, so its marks are not lost. */
  liveTargets(): string[];
  /** The node behind a public id, or undefined. */
  nodeOf(id: string): FoundMark | undefined;
  /** Every selected mark's public id, target by target. */
  selection(): string[];
}

export function createMarkReads({ scenes, targets, contentOf }: MarkReadsOptions): MarkReads {
  const project = (target: string, node: string): Annotation | undefined => {
    const found = scenes.get(target)?.get(asNodeId(node));
    if (!found) return undefined;
    const { shape, ...data } = found.data;
    const frac = roundFrac(worldToFrac(found.pose as MarkPose, contentOf(target)));
    const points =
      data.kind === 'point'
        ? [{ x: frac.x, y: frac.y }]
        : shape && roundPoints(fromShape(shape, frac));
    return { ...data, target, id: markIdOf(target, node), frac, ...(points ? { points } : {}) };
  };

  const liveTargets = (): string[] => {
    const declared = targets().map((t) => t.id);
    const rest = [...scenes.keys()].filter((id) => !declared.includes(id));
    return [...declared, ...rest];
  };

  const marksOn = (target: string): Annotation[] => {
    const scene = scenes.get(target);
    if (!scene) return [];
    const out: Annotation[] = [];
    for (const id of scene.renderOrder()) {
      const a = project(target, String(id));
      if (a) out.push(a);
    }
    return out;
  };

  const nodeOf = (id: string): FoundMark | undefined => {
    const parts = splitMarkId(id);
    if (!parts) return undefined;
    const scene = scenes.get(parts.target);
    const node = scene?.get(asNodeId(parts.node));
    return node && scene ? { target: parts.target, scene, node } : undefined;
  };

  const selection = (): string[] => {
    const out: string[] = [];
    for (const target of liveTargets()) {
      const scene = scenes.get(target);
      if (!scene) continue;
      for (const node of scene.getSelection()) {
        if (scene.get(node)) out.push(markIdOf(target, node));
      }
    }
    return out;
  };

  return {
    project,
    marksOn,
    all: () => liveTargets().flatMap(marksOn),
    liveTargets,
    nodeOf,
    selection,
  };
}
