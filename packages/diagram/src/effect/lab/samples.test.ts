import { describe, expect, it } from 'vitest';
import { diagramScene } from '../../fromData';
import { checkPipeline } from '../check';
import { EFFECT_LOOKS } from '../looks';
import { SAMPLES } from './samples';

describe('lab samples', () => {
  it('has the samples the lab offers', () => {
    expect(Object.keys(SAMPLES)).toEqual(['chain', 'branch', 'sideInputs', 'skip', 'bands', 'large', 'broken']);
  });

  it('is sound everywhere but the one that is wrong on purpose', () => {
    for (const [name, pipeline] of Object.entries(SAMPLES)) {
      const problems = checkPipeline(pipeline);
      if (name === 'broken') expect(problems.length).toBeGreaterThan(1);
      else expect(problems, name).toEqual([]);
    }
  });

  it('has about forty stages in the large one', () => {
    expect(SAMPLES.large!.stages.length).toBeGreaterThanOrEqual(36);
  });

  it('draws under every look', () => {
    for (const [name, pipeline] of Object.entries(SAMPLES)) {
      for (const [lookName, look] of Object.entries(EFFECT_LOOKS)) {
        const { data, scene } = look(pipeline);
        expect(() => diagramScene(data, scene), `${name} / ${lookName}`).not.toThrow();
      }
    }
  });
});
