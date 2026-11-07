import { BaseSequencer, type TestSpecification } from 'vitest/node';
import { relative } from 'node:path';
import { balancedSlices, DURATIONS_ENV, sliceId } from './lib/browser-shards.mjs';

const parse = (raw: string): Record<string, number> => {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' ? (value as Record<string, number>) : {};
  } catch {
    return {};
  }
};

/**
 * `--shard` by recorded duration when the launcher passes a snapshot of them in WEASEL_SHARD_DURATIONS
 * (`scripts/vitest-overlap.mjs`), and vitest's own count-based split otherwise. Each process reads the
 * snapshot rather than the results cache, which a sibling rewrites as its files finish.
 */
export class DurationSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const raw = process.env[DURATIONS_ENV];
    const shard = this.ctx.config.shard;
    if (raw === undefined || !shard) return super.shard(files);
    const root = this.ctx.config.root;
    const byId = new Map(files.map((spec) => [sliceId(spec.project.name, relative(root, spec.moduleId)), spec]));
    const durations = parse(raw);
    const slices = balancedSlices([...byId.keys()], durations, shard.count);
    const mine = slices[shard.index - 1];
    const recorded = mine.ids.filter((id) => id in durations).length;
    console.log(
      `duration-sequencer: slice ${shard.index}/${shard.count} holds ${mine.ids.length} of ${byId.size} files, ` +
        `${(mine.ms / 1000).toFixed(1)} s recorded (${recorded} with a record); slices ${slices.map((s) => (s.ms / 1000).toFixed(1)).join(' / ')} s`,
    );
    return mine.ids.map((id) => byId.get(id)!);
  }
}
