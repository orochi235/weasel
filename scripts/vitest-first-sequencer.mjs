/**
 * vitest's sequencer, with the files a fleet tree's marker lists as failing last run moved to the front
 * (`scripts/lib/fleet-first.mjs`), so a repeat failure shows in the run's first minute.
 */
import { relative } from 'node:path';
import { BaseSequencer } from 'vitest/node';
import { firstInTree } from './lib/fleet-first.mjs';

export default class FirstFailedSequencer extends BaseSequencer {
  async sort(files) {
    const sorted = await super.sort(files);
    const root = this.ctx.config.root;
    const first = new Set(firstInTree(root));
    if (first.size === 0) return sorted;
    const isFirst = (spec) => first.has(relative(root, spec.moduleId));
    return [...sorted.filter(isFirst), ...sorted.filter((spec) => !isFirst(spec))];
  }
}
