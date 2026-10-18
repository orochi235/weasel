import { asNodeId, type EditableShape } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { createLabScene, SHAPE_ID } from '../PuppetSolverLabDemo';
import { areaColor, backwardCommands, INVERTED, meshCommands } from '../puppetSolverLab/meshLayer';
import { meshModelOf } from '../puppetSolverLab/meshModel';
import type { PresetId } from '../puppetSolverLab/presets';

const modelOf = (preset: PresetId) =>
  meshModelOf(createLabScene(preset).get(asNodeId(SHAPE_ID)) as EditableShape, 'step2')!;

const colorsOf = (cmds: ReturnType<typeof meshCommands>) =>
  cmds.flatMap((c) => (c.kind === 'path' && c.fill ? [(c.fill.paint as { color: string }).color] : []));

describe('the puppet solver lab mesh', () => {
  it('turns triangles over in the two failure presets and none in the gentle bend', () => {
    const disc = modelOf('disc'), bar = modelOf('bar-s'), bend = modelOf('bend');
    expect(disc.inverted).toBeGreaterThan(0);
    expect(disc.invertedOnOutline).toBeGreaterThan(0);
    expect(bar.inverted).toBeGreaterThan(0);
    expect(bend.inverted).toBe(0);
  });

  it('fills turned-over triangles magenta, and only those', () => {
    const disc = modelOf('disc');
    expect(colorsOf(meshCommands(disc, 'area', 1))).toContain(INVERTED);
    expect(colorsOf(meshCommands(modelOf('bend'), 'area', 1))).not.toContain(INVERTED);
    expect(areaColor(0)).toBe(INVERTED);
    expect(areaColor(-0.5)).toBe(INVERTED);
    expect(areaColor(1)).not.toBe(INVERTED);
  });

  it('keeps magenta in wireframe, where the other fills drop out, and draws nothing hidden', () => {
    const disc = modelOf('disc');
    expect(colorsOf(meshCommands(disc, 'wire', 1))).toEqual([INVERTED]);
    expect(meshCommands(disc, 'off', 1)).toEqual([]);
  });

  it('rings every turned-over triangle, and draws the outline stretch only of one on the outline', () => {
    const disc = modelOf('disc'), bar = modelOf('bar-s');
    const discMarks = backwardCommands(disc, 1);
    expect(discMarks).toHaveLength(disc.inverted + 1);
    for (const mark of discMarks) expect(mark.kind === 'path' && mark.stroke?.paint).toMatchObject({ color: INVERTED });
    expect(backwardCommands(bar, 1)).toHaveLength(bar.inverted);
    expect(backwardCommands(modelOf('bend'), 1)).toEqual([]);
  });
});
