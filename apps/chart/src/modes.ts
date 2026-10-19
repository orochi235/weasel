import { useCommand } from '@weasel-js/core';
import { run, type MenuRuns } from './menuBar';

export type ChartMode = 'chart' | 'pipeline';

export const MODE_ACTIONS = { chart: 'mode.chart', pipeline: 'mode.pipeline' } as const;

/** The Mode menu, the same in every mode. */
export const MODE_MENU: MenuRuns = { modes: run({ chart: MODE_ACTIONS.chart, pipeline: MODE_ACTIONS.pipeline }) };

/** Registers Mode › Chart and Mode › Pipeline, each reading as held while its mode is on. */
export function useModeCommands(mode: ChartMode, setMode: (mode: ChartMode) => void): void {
  useCommand(MODE_ACTIONS.chart, 'Chart', () => setMode('chart'), { active: () => mode === 'chart' });
  useCommand(MODE_ACTIONS.pipeline, 'Pipeline', () => setMode('pipeline'), { active: () => mode === 'pipeline' });
}
