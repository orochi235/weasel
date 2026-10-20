import { useCommand } from '@weasel-js/core';
import {
  imageEvaluators, imageValueKinds, testCard, useEffectRunner, type EffectPipeline, type EffectRun, type RunRowOptions,
} from '@weasel-js/diagram/effect';
import { pickFile } from '@editor/index';
import { pref } from '@weasel-js/prefs';
import { useMemo, useState } from 'react';
import { can, run, type MenuRuns } from '../menuBar';

export const RUN_ACTIONS = {
  run: 'pipeline.run', step: 'pipeline.step', play: 'pipeline.play', pause: 'pipeline.pause', reset: 'pipeline.reset',
  source: 'pipeline.source', showValues: 'pipeline.showValues', showPreviews: 'pipeline.showPreviews',
} as const;

/** Pipeline mode's Run menu. */
export const RUN_MENU: MenuRuns = {
  once: run({ run: RUN_ACTIONS.run, step: RUN_ACTIONS.step }),
  play: run({ play: RUN_ACTIONS.play, pause: RUN_ACTIONS.pause, reset: RUN_ACTIONS.reset }),
  source: run({ source: RUN_ACTIONS.source }),
};

/** The View menu's run rows: Show Values and Show Previews. */
export const SHOW_MENU: MenuRuns = {
  show: pref.group('', { values: pref.action(RUN_ACTIONS.showValues), previews: pref.action(RUN_ACTIONS.showPreviews) }),
};

/** The side of a test card sources start from. */
const CARD_SIZE = 256;

/** What pipeline mode draws a run with: the run, and the look options that keep rows for it. */
export interface PipelineRun {
  run: EffectRun | undefined;
  rows: RunRowOptions;
}

/** Runs `pipeline` over the chosen source image, or a test card until one is
 *  chosen, and registers the Run menu and View › Show Values and Show Previews. */
export function usePipelineRun(pipeline: EffectPipeline): PipelineRun {
  const [sources, setSources] = useState<{ image: ImageBitmap } | undefined>(undefined);
  const [showValues, setShowValues] = useState(false);
  const [showPreviews, setShowPreviews] = useState(false);
  const runner = useEffectRunner({
    pipeline, evaluators: imageEvaluators, kinds: imageValueKinds, previews: showPreviews, ...(sources !== undefined ? { sources } : {}),
  });
  const r = runner.runner;
  // The test card is drawn on the first run, not on mount, so the mode costs nothing until it runs.
  const prime = () => {
    if (sources !== undefined) return;
    const card = { image: testCard(CARD_SIZE) };
    r.setSources(card);
    setSources(card);
  };

  useCommand(RUN_ACTIONS.run, 'Run', () => { prime(); void r.run(); });
  useCommand(RUN_ACTIONS.step, 'Step', () => { prime(); void r.step(); });
  useCommand(RUN_ACTIONS.play, 'Play', () => { prime(); r.play(); }, { enabled: () => can(!r.state.playing) });
  useCommand(RUN_ACTIONS.pause, 'Pause', () => r.pause(), { enabled: () => can(r.state.playing) });
  useCommand(RUN_ACTIONS.reset, 'Reset', () => r.reset());
  useCommand(RUN_ACTIONS.source, 'Choose Source Image…', () => {
    chooseImage().then((image) => { if (image !== null) setSources({ image }); })
      .catch((err: unknown) => console.warn('weaselchart: could not read the image', err));
  });
  useCommand(RUN_ACTIONS.showValues, 'Show Values', () => setShowValues((v) => !v), { active: () => showValues });
  useCommand(RUN_ACTIONS.showPreviews, 'Show Previews', () => setShowPreviews((v) => !v), { active: () => showPreviews });

  const rows = useMemo(() => ({ showValues, showPreviews }), [showValues, showPreviews]);
  return { run: runner.run, rows };
}

async function chooseImage(): Promise<ImageBitmap | null> {
  const file = await pickFile('image/*');
  return file === null ? null : createImageBitmap(file);
}
