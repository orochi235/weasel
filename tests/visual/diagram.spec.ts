/**
 * Visual regression spec: the diagram demos.
 *
 * A node body is measured, not authored. jsdom measures its text as zero, so
 * a body collapsed to nothing satisfies every geometry test in the suite.
 * Only a render says the rows fit inside the outline and the ports sit on it.
 * Likewise a router's legs and an arrowhead's inset are geometry no unit test
 * looks at once the path is a `d` string.
 *
 * Determinism: both demos are fixed literals that route on mount and animate
 * nothing.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline, type DiffOptions } from './diff.js';

const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

// Tighter than the 2% default: these canvases are mostly empty, so a node
// moving 10px is only half a percent of the pixels and passes at the default.
const OPTS: DiffOptions = { maxDiffRatio: 0.004 };

test('diagram-nodes — bodies measured, ports on the outline', async ({ page }) => {
  const png = await captureCanvas(page, '/#diagram-nodes');
  assertMatchesBaseline(png, resolve(BASELINE_DIR, 'diagram-nodes.png'), OPTS);
});

test('diagram-edges — routed legs and their labels', async ({ page }) => {
  const png = await captureCanvas(page, '/#diagram-edges');
  assertMatchesBaseline(png, resolve(BASELINE_DIR, 'diagram-edges.png'), OPTS);
});
