import { describe, expect, it } from 'vitest';
import { checkPipeline, shownPorts } from '@weasel-js/diagram/effect';
import { PIPELINE, pictureOf } from '../EffectChartDemo';

describe('EffectChartDemo', () => {
  it('draws a pipeline with no problems', () => {
    expect(checkPipeline(PIPELINE)).toEqual([]);
  });

  it("gives every preview slot a picture, Out's the one Composite sends it", () => {
    for (const stage of PIPELINE.stages) {
      for (const port of shownPorts(stage)) expect(pictureOf(stage.id, port.id), `${stage.id}.${port.id}`).toBeDefined();
    }
    expect(pictureOf('out', 'in')).toBe(pictureOf('mix', 'out'));
  });
});
