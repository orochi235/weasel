import { describe, expect, it } from 'vitest';
import { nightStages } from './map.mjs';

describe('nightStages', () => {
  it('takes each area to the furthest step its log lines reach', () => {
    const log = [
      'control sweep: 0 dead, 19 unsure, 1086 skipped of 2503 controls in 180 demos, 29.4 min',
      'review 1/16 apps.chart A on studio: 0 findings, 3/3 files read, 3.4 min, 0.54M tokens',
      'review 2/16 apps.chart B on studio: 1 findings, 3/3 files read, 3.5 min, 0.58M tokens',
      'review 3/16 core.core B on teitou: 5 findings, 35/35 files read, 3.8 min, 2.25M tokens',
      'match 1/8 apps.chart: 0 shared of 0 + 1',
      'fix 1/8 apps.chart on studio: 1 commits, 8.0 min, 0.79M tokens',
      'patch apps.chart: 1 commits on audit40-apps.chart',
      'review 4/16 core.canvas.part1 A on studio: 3 findings, 47/47 files read, 5.5 min, 5.79M tokens',
      'review 5/16 core.canvas.part1 B on studio: 3 findings, 47/47 files read, 13.7 min, 9.96M tokens',
      'patch core.canvas.part1: 6 commits on audit40-core.canvas.part1',
      'batch: audit40-core.canvas.part1 conflicts; left out',
    ].join('\n');
    expect(Object.fromEntries(nightStages(log))).toEqual({
      'apps.chart': 'patched',
      'core.core': 'reviewing',
      'core.canvas.part1': 'conflict',
    });
  });
});
