import { useCommand } from '@weasel-js/core';
import {
  imageEvaluators, imageValueKinds, testCard, useEffectRunner, type EffectPipeline, type EffectRun, type RunRowOptions,
} from '@weasel-js/diagram/effect';
import { pickFile, menuRun, type MenuRuns } from '@weasel-js/editor';
import { pref } from '@weasel-js/prefs';
import { useMemo, useState } from 'react';
import { can } from '../menuBar';
import { mergeRuns, splitDomains, usePipelineAudio } from './pipelineAudio';

export const RUN_ACTIONS = {
  run: 'pipeline.run', step: 'pipeline.step', play: 'pipeline.play', pause: 'pipeline.pause', reset: 'pipeline.reset',
  source: 'pipeline.source', audioSource: 'pipeline.audioSource',
  showValues: 'pipeline.showValues', showPreviews: 'pipeline.showPreviews', showSpectrum: 'pipeline.showSpectrum',
} as const;

/** Pipeline mode's Run menu. */
export const RUN_MENU: MenuRuns = {
  once: menuRun({ run: RUN_ACTIONS.run, step: RUN_ACTIONS.step }),
  play: menuRun({ play: RUN_ACTIONS.play, pause: RUN_ACTIONS.pause, reset: RUN_ACTIONS.reset }),
  source: menuRun({ source: RUN_ACTIONS.source, audioSource: RUN_ACTIONS.audioSource }),
};

/** The View menu's run rows: Show Values, Show Previews and Show Spectrum. */
export const SHOW_MENU: MenuRuns = {
  show: pref.group('', {
    values: pref.action(RUN_ACTIONS.showValues),
    previews: pref.action(RUN_ACTIONS.showPreviews),
    spectrum: pref.action(RUN_ACTIONS.showSpectrum),
  }),
};

/** The side of a test card sources start from. */
const CARD_SIZE = 256;

/** What pipeline mode draws a run with: the run, and the look options that keep rows for it. */
export interface PipelineRun {
  run: EffectRun | undefined;
  rows: RunRowOptions;
}

/** Runs the image stages of `pipeline` over the chosen source image, or a test card until one is
 *  chosen, plays its audio stages live, and registers the Run menu and View's run rows. */
export function usePipelineRun(pipeline: EffectPipeline): PipelineRun {
  const [sources, setSources] = useState<{ image: ImageBitmap } | undefined>(undefined);
  const [showValues, setShowValues] = useState(false);
  const [showPreviews, setShowPreviews] = useState(false);
  const [showSpectrum, setShowSpectrum] = useState(false);
  const split = useMemo(() => splitDomains(pipeline), [pipeline]);
  const runner = useEffectRunner({
    pipeline: split.image, evaluators: imageEvaluators, kinds: imageValueKinds, previews: showPreviews,
    ...(sources !== undefined ? { sources } : {}),
  });
  const audio = usePipelineAudio(split.audio, showPreviews ? (showSpectrum ? 'spectrum' : 'scope') : 'off');
  const r = runner.runner;
  const hasAudio = split.audio.stages.length > 0;
  const playing = () => r.state.playing || audio.runner?.state.playing === true;
  // The test card is drawn on the first run, not on mount, so the mode costs nothing until it runs.
  const prime = () => {
    if (sources !== undefined) return;
    const card = { image: testCard(CARD_SIZE) };
    r.setSources(card);
    setSources(card);
  };

  useCommand(RUN_ACTIONS.run, 'Run', () => { prime(); void r.run(); });
  useCommand(RUN_ACTIONS.step, 'Step', () => { prime(); void r.step(); });
  useCommand(RUN_ACTIONS.play, 'Play', () => {
    // An audio-only pipeline leaves the image runner idle; one with no audio makes no engine.
    if (split.image.stages.length > 0 || !hasAudio) { prime(); r.play(); }
    if (hasAudio) audio.wake().play().catch((err: unknown) => console.warn('weaselchart: could not play the audio', err));
  }, { enabled: () => can(!playing()) });
  useCommand(RUN_ACTIONS.pause, 'Pause', () => { r.pause(); audio.runner?.pause(); }, { enabled: () => can(playing()) });
  useCommand(RUN_ACTIONS.reset, 'Reset', () => { r.reset(); audio.runner?.reset(); });
  useCommand(RUN_ACTIONS.source, 'Choose Source Image…', () => {
    chooseImage().then((image) => { if (image !== null) setSources({ image }); })
      .catch((err: unknown) => console.warn('weaselchart: could not read the image', err));
  });
  useCommand(RUN_ACTIONS.audioSource, 'Choose Source Audio…', () => {
    audio.chooseSource().catch((err: unknown) => console.warn('weaselchart: could not read the audio', err));
  });
  useCommand(RUN_ACTIONS.showValues, 'Show Values', () => setShowValues((v) => !v), { active: () => showValues });
  useCommand(RUN_ACTIONS.showPreviews, 'Show Previews', () => setShowPreviews((v) => !v), { active: () => showPreviews });
  useCommand(RUN_ACTIONS.showSpectrum, 'Show Spectrum', () => setShowSpectrum((v) => !v), {
    active: () => showSpectrum, enabled: () => can(showPreviews),
  });

  const rows = useMemo(() => ({ showValues, showPreviews }), [showValues, showPreviews]);
  const merged = useMemo(() => mergeRuns(runner.run, audio.run), [runner.run, audio.run]);
  return { run: merged, rows };
}

async function chooseImage(): Promise<ImageBitmap | null> {
  const file = await pickFile('image/*');
  return file === null ? null : createImageBitmap(file);
}
