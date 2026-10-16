import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline, type DiffOptions } from './diff.js';

const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

// These canvases are mostly empty, so a stage moving 10px is well under the 2% default.
const OPTS: DiffOptions = { maxDiffRatio: 0.004 };

test('effect-chart: node-graph look', async ({ page }) => {
  const png = await captureCanvas(page, '/#effect-chart');
  assertMatchesBaseline(png, resolve(BASELINE_DIR, 'effect-chart.png'), OPTS);
});

test('effect-chart-rack: rack look', async ({ page }) => {
  const png = await captureCanvas(page, '/#effect-chart-rack');
  assertMatchesBaseline(png, resolve(BASELINE_DIR, 'effect-chart-rack.png'), OPTS);
});
