import { asNodeId, type EditableShape } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { createLabScene, SHAPE_ID } from '../PuppetSolverLabDemo';
import { areaColor, backwardCommands, INVERTED, meshCommands } from '../puppetSolverLab/meshLayer';
import { meshModelOf, type StepPick } from '../puppetSolverLab/meshModel';
import type { PresetId } from '../puppetSolverLab/presets';

/** Index 1 is the second linear step: what the two-step solve alone returns. */
const TWO_STEP = 1;

const modelOf = (preset: PresetId, pick: StepPick = null) =>
  meshModelOf(createLabScene(preset).get(asNodeId(SHAPE_ID)) as EditableShape, pick)!;

const colorsOf = (cmds: ReturnType<typeof meshCommands>) =>
  cmds.flatMap((c) => (c.kind === 'path' && c.fill ? [(c.fill.paint as { color: string }).color] : []));

describe('the puppet solver lab mesh', () => {
  it('traces the two linear steps first, and ends on the result', () => {
    const disc = modelOf('disc');
    expect(disc.steps.slice(0, 2).map((s) => s.stage)).toEqual(['similarity', 'rigid']);
    expect(disc.index).toBe(disc.steps.length - 1);
    expect(modelOf('disc', 10_000).index).toBe(disc.index);
  });

  it('shows the two-step solve folding both failure presets, and the untangling pass clearing them', () => {
    for (const preset of ['disc', 'bar-s'] as const) {
      expect(modelOf(preset, TWO_STEP).inverted, preset).toBeGreaterThan(0);
      const result = modelOf(preset);
      expect(result.inverted, preset).toBe(0);
      expect(result.steps.at(-1)!.stage, preset).toBe('injective');
    }
    expect(modelOf('disc', TWO_STEP).invertedOnOutline).toBeGreaterThan(0);
    expect(modelOf('bend', TWO_STEP).inverted).toBe(0);
    expect(modelOf('bend').steps.some((s) => s.stage === 'injective')).toBe(false);
  });

  it('fills turned-over triangles magenta, and only those', () => {
    expect(colorsOf(meshCommands(modelOf('disc', TWO_STEP), 'area', 1))).toContain(INVERTED);
    expect(colorsOf(meshCommands(modelOf('disc'), 'area', 1))).not.toContain(INVERTED);
    expect(areaColor(0)).toBe(INVERTED);
    expect(areaColor(-0.5)).toBe(INVERTED);
    expect(areaColor(1)).not.toBe(INVERTED);
  });

  it('keeps magenta in wireframe, where the other fills drop out, and draws nothing hidden', () => {
    const disc = modelOf('disc', TWO_STEP);
    expect(colorsOf(meshCommands(disc, 'wire', 1))).toEqual([INVERTED]);
    expect(meshCommands(disc, 'off', 1)).toEqual([]);
  });

  it('rings every turned-over triangle, and draws the outline stretch only of one on the outline', () => {
    const disc = modelOf('disc', TWO_STEP), bar = modelOf('bar-s', TWO_STEP);
    const discMarks = backwardCommands(disc, 1);
    expect(discMarks).toHaveLength(disc.inverted + 1);
    for (const mark of discMarks) expect(mark.kind === 'path' && mark.stroke?.paint).toMatchObject({ color: INVERTED });
    expect(backwardCommands(bar, 1)).toHaveLength(bar.inverted + (bar.invertedOnOutline > 0 ? 1 : 0));
    expect(backwardCommands(modelOf('disc'), 1)).toEqual([]);
  });
});
