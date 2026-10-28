import { describe, expect, it } from 'vitest';
import { checkPipeline, shownPorts } from '@weasel-js/diagram/effect';
import { PIPELINE } from '../EffectChartDemo';
import { PAINTERS } from '../effectChartPictures';

describe('EffectChartDemo', () => {
  it('draws a pipeline with no problems', () => {
    expect(checkPipeline(PIPELINE)).toEqual([]);
  });

  it('has a way to draw every preview slot, and no slot the chart lacks', () => {
    const slots = PIPELINE.stages.flatMap((stage) => shownPorts(stage).map((p) => `${stage.id}/${p.id}`));
    expect(Object.keys(PAINTERS).sort()).toEqual(slots.sort());
  });
});
