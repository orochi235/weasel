import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from '@weasel-js/audio';
import { pickFile } from '@weasel-js/editor';
import { stageFromType, type EffectPipeline } from '@weasel-js/diagram/effect';
import { AUDIO_STAGE_TYPES, createLiveAudioRunner } from '@weasel-js/diagram/effect-audio';
import { mergeRuns, splitDomains, usePipelineAudio } from './pipelineAudio';

vi.mock('@weasel-js/editor', async (original) => ({ ...(await original<object>()), pickFile: vi.fn() }));
vi.mock('@weasel-js/audio', async (original) => ({ ...(await original<object>()), createAudioEngine: vi.fn() }));
vi.mock('@weasel-js/diagram/effect-audio', async (original) => ({
  ...(await original<object>()), createLiveAudioRunner: vi.fn(),
}));

const wire = (id: string, from: string, to: string) => ({ id, from: { stage: from, port: 'out' }, to: { stage: to, port: 'in' } });

describe('splitDomains', () => {
  it('puts each stage on the side of its domain, and each wire between two of them, and keeps types and clusters on both', () => {
    const pipeline: EffectPipeline = {
      stages: [
        { id: 'src', title: 'Source', type: 'source' },
        { id: 'blur', title: 'Blur', type: 'blur' },
        { id: 'osc', title: 'Oscillator', type: 'audio.oscillator' },
        { id: 'gain', title: 'Gain', type: 'audio.gain' },
      ],
      wires: [wire('w1', 'src', 'blur'), wire('w2', 'osc', 'gain'), wire('w3', 'blur', 'gain')],
      clusters: [{ id: 'g', label: 'All', members: ['blur', 'gain'] }],
      types: { number: { control: true } },
    };
    const { image, audio } = splitDomains(pipeline);
    expect(image.stages.map((s) => s.id)).toEqual(['src', 'blur']);
    expect(audio.stages.map((s) => s.id)).toEqual(['osc', 'gain']);
    expect(image.wires.map((w) => w.id)).toEqual(['w1']);
    expect(audio.wires.map((w) => w.id)).toEqual(['w2']);
    for (const half of [image, audio]) {
      expect(half.clusters).toBe(pipeline.clusters);
      expect(half.types).toBe(pipeline.types);
    }
  });
});

describe('mergeRuns', () => {
  it('keeps the stage a stepped run is on', () => {
    const merged = mergeRuns({ stages: { blur: { cost: 1 } }, at: 'blur' }, { stages: { 'audio.file': { error: 'no source audio' } } });
    expect(merged).toEqual({ stages: { blur: { cost: 1 }, 'audio.file': { error: 'no source audio' } }, at: 'blur' });
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

  it('makes no engine for a file chosen after the component went', async () => {
    let choose!: (file: File) => void;
    vi.mocked(pickFile).mockReturnValue(new Promise((resolve) => { choose = resolve; }));
    const { result, unmount } = renderHook(() => usePipelineAudio({ stages: [], wires: [] }, 'off'));
    const picking = result.current.chooseSource();
    unmount();
    await act(async () => {
      choose(new File([new Uint8Array(4)], 'a.wav'));
      await picking.catch(() => {});
    });
    expect(createAudioEngine).not.toHaveBeenCalled();
  });

  it('settles quietly when the component goes while a file decodes', async () => {
    let fail!: (err: Error) => void;
    const decodeAudioData = () => new Promise<AudioBuffer>((_, reject) => { fail = reject; });
    vi.mocked(createAudioEngine).mockReturnValue({ context: { decodeAudioData }, dispose: vi.fn() } as never);
    vi.mocked(createLiveAudioRunner).mockReturnValue({
      setSources: vi.fn(), setPipeline: vi.fn(), setPreviews: vi.fn(), drawn: vi.fn(), dispose: vi.fn(),
      subscribe: () => () => {}, state: { run: undefined, playing: false },
    } as never);
    vi.mocked(pickFile).mockResolvedValue(new File([new Uint8Array(4)], 'a.wav'));
    const { result, unmount } = renderHook(() => usePipelineAudio({ stages: [], wires: [] }, 'off'));
    const picking = result.current.chooseSource();
    await vi.waitFor(() => expect(fail).toBeDefined(), { timeout: 10_000 });
    unmount();
    fail(new Error('the context was closed'));
    await expect(picking).resolves.toBeUndefined();
  });

  it('still reports a file that fails to decode', async () => {
    const decodeAudioData = () => Promise.reject(new Error('unreadable'));
    vi.mocked(createAudioEngine).mockReturnValue({ context: { decodeAudioData }, dispose: vi.fn() } as never);
    vi.mocked(pickFile).mockResolvedValue(new File([new Uint8Array(4)], 'a.wav'));
    const { result } = renderHook(() => usePipelineAudio({ stages: [], wires: [] }, 'off'));
    await act(async () => {
      await expect(result.current.chooseSource()).rejects.toThrow('unreadable');
    });
  });

  it('keeps the file picked last when an earlier one finishes decoding after it', async () => {
    const decodes: { resolve: (b: AudioBuffer) => void }[] = [];
    const decodeAudioData = () => new Promise<AudioBuffer>((resolve) => { decodes.push({ resolve }); });
    vi.mocked(createAudioEngine).mockReturnValue({ context: { decodeAudioData }, dispose: vi.fn() } as never);
    const setSources = vi.fn();
    vi.mocked(createLiveAudioRunner).mockReturnValue({
      setSources, setPipeline: vi.fn(), setPreviews: vi.fn(), drawn: vi.fn(), dispose: vi.fn(),
      subscribe: () => () => {}, state: { run: undefined, playing: false },
    } as never);
    vi.mocked(pickFile).mockResolvedValue(new File([new Uint8Array(4)], 'a.wav'));
    const { result } = renderHook(() => usePipelineAudio({ stages: [], wires: [] }, 'off'));
    const slow = result.current.chooseSource();
    await vi.waitFor(() => expect(decodes).toHaveLength(1), { timeout: 10_000 });
    const fast = result.current.chooseSource();
    await vi.waitFor(() => expect(decodes).toHaveLength(2), { timeout: 10_000 });
    const late = { duration: 60 } as AudioBuffer;
    const next = { duration: 1 } as AudioBuffer;
    await act(async () => {
      decodes[1]?.resolve(next);
      await fast;
    });
    await act(async () => {
      decodes[0]?.resolve(late);
      await slow;
    });
    expect(setSources).toHaveBeenLastCalledWith({ audio: next });
  });
});
