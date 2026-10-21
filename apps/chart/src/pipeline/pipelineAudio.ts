import { createAudioEngine, type AudioEngine } from '@weasel-js/audio';
import type { EffectPipeline, EffectRun } from '@weasel-js/diagram/effect';
import {
  AUDIO_STAGE_TYPES, createLiveAudioRunner, useFollowAudioRunner,
  type AudioPreview, type AudioSources, type LiveAudioRunner,
} from '@weasel-js/diagram/effect-audio';
import { pickFile } from '@editor/index';
import { useLatest } from '@weasel-js/react';
import { useCallback, useEffect, useRef, useState } from 'react';

const AUDIO_TYPES = new Set(AUDIO_STAGE_TYPES.map((t) => t.type));

/** `pipeline` as its image stages and its audio stages, each with the wires between its own stages. */
export function splitDomains(pipeline: EffectPipeline): { image: EffectPipeline; audio: EffectPipeline } {
  const half = (audio: boolean): EffectPipeline => {
    const stages = pipeline.stages.filter((s) => (s.type !== undefined && AUDIO_TYPES.has(s.type)) === audio);
    const ids = new Set(stages.map((s) => s.id));
    return { ...pipeline, stages, wires: pipeline.wires.filter((w) => ids.has(w.from.stage) && ids.has(w.to.stage)) };
  };
  return { image: half(false), audio: half(true) };
}

const hasStages = (run: EffectRun | undefined): run is EffectRun => run !== undefined && Object.keys(run.stages).length > 0;

/** One run holding the stages of both; undefined when neither has any. */
export function mergeRuns(a: EffectRun | undefined, b: EffectRun | undefined): EffectRun | undefined {
  if (!hasStages(b)) return a;
  if (!hasStages(a)) return b;
  return { stages: { ...a.stages, ...b.stages } };
}

/** What pipeline mode plays its audio stages with. */
export interface PipelineAudio {
  run: EffectRun | undefined;
  /** Null until `wake` or `chooseSource` first makes it. */
  runner: LiveAudioRunner | null;
  /** The runner, making it and its engine on the first call. */
  wake(): LiveAudioRunner;
  /** Asks for an audio file and decodes it as the File stages' source. */
  chooseSource(): Promise<void>;
}

interface Live { engine: AudioEngine; runner: LiveAudioRunner }

/**
 * Plays the audio pipeline `pipeline` through an engine made on the first `wake` or `chooseSource`,
 * never on mount, and disposed with the component. Until then the run carries the plan's errors, so a
 * File stage says it has no source audio from the start.
 */
export function usePipelineAudio(pipeline: EffectPipeline, previews: AudioPreview): PipelineAudio {
  const [sources, setSources] = useState<AudioSources>({});
  const [live, setLive] = useState<Live | null>(null);
  const current = useRef<Live | null>(null);
  const latest = useLatest({ pipeline, sources });

  const awake = useCallback((): Live => {
    if (current.current !== null) return current.current;
    const engine = createAudioEngine();
    const made = { engine, runner: createLiveAudioRunner({ engine, ...latest.current }) };
    current.current = made;
    setLive(made);
    return made;
  }, [latest]);
  useEffect(() => () => {
    current.current?.runner.dispose();
    current.current?.engine.dispose();
    current.current = null;
  }, []);

  const runner = live?.runner ?? null;
  const { run } = useFollowAudioRunner(runner, { pipeline, sources, previews });

  const chooseSource = useCallback(async () => {
    const file = await pickFile('audio/*');
    if (file === null) return;
    const { engine } = awake();
    setSources({ audio: await engine.context.decodeAudioData(await file.arrayBuffer()) });
  }, [awake]);
  const wake = useCallback(() => awake().runner, [awake]);

  return { run, runner, wake, chooseSource };
}
