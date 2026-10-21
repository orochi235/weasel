import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { stageFromType, type EffectPipeline } from '@weasel-js/diagram/effect';
import { AUDIO_STAGE_TYPES } from '@weasel-js/diagram/effect-audio';
import { splitDomains, usePipelineAudio } from './pipelineAudio';

const wire = (id: string, from: string, to: string) => ({ id, from: { stage: from, port: 'out' }, to: { stage: to, port: 'in' } });

describe('splitDomains', () => {
  it('puts each stage on the side of its domain, and each wire between two of them, and keeps types and groups on both', () => {
    const pipeline: EffectPipeline = {
      stages: [
        { id: 'src', title: 'Source', type: 'source' },
        { id: 'blur', title: 'Blur', type: 'blur' },
        { id: 'osc', title: 'Oscillator', type: 'audio.oscillator' },
        { id: 'gain', title: 'Gain', type: 'audio.gain' },
      ],
      wires: [wire('w1', 'src', 'blur'), wire('w2', 'osc', 'gain'), wire('w3', 'blur', 'gain')],
      groups: [{ id: 'g', label: 'All', members: ['blur', 'gain'] }],
      types: { number: { control: true } },
    };
    const { image, audio } = splitDomains(pipeline);
    expect(image.stages.map((s) => s.id)).toEqual(['src', 'blur']);
    expect(audio.stages.map((s) => s.id)).toEqual(['osc', 'gain']);
    expect(image.wires.map((w) => w.id)).toEqual(['w1']);
    expect(audio.wires.map((w) => w.id)).toEqual(['w2']);
    for (const half of [image, audio]) {
      expect(half.groups).toBe(pipeline.groups);
      expect(half.types).toBe(pipeline.types);
    }
  });
});

describe('usePipelineAudio', () => {
  it('says a File stage has no source audio before any engine is made', () => {
    const typed = (type: string) => stageFromType(AUDIO_STAGE_TYPES.find((t) => t.type === type)!, type);
    const pipeline: EffectPipeline = {
      stages: [typed('audio.file'), typed('audio.output')],
      wires: [wire('w1', 'audio.file', 'audio.output')],
    };
    const { result } = renderHook(() => usePipelineAudio(pipeline, 'off'));
    expect(result.current.runner).toBeNull();
    expect(result.current.run?.stages['audio.file']?.error).toBe('no source audio');
  });
});
