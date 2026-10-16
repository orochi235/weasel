import { describe, expect, it } from 'vitest';
import { checkPipeline } from '@weasel-js/diagram/effect';
import { PIPELINE } from '../EffectChartDemo';

describe('EffectChartDemo', () => {
  it('draws a pipeline with no problems', () => {
    expect(checkPipeline(PIPELINE)).toEqual([]);
  });
});
