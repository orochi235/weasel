import { describe, expect, it } from 'vitest';
import { AUTO } from '../config/auto';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { settingsJson } from './trialActions';
import type { TrialChromeContext } from './types';

describe('settingsJson', () => {
  it('copies the value an instrument reported for an auto path, as the Settings panel shows it', () => {
    const ctx = {
      configSchema: resolveConfigSchema(
        f.schema({
          bins: f.number(10).auto(),
          gap: f.number(12).auto(() => 4),
        }),
        [],
      ),
      config: { bins: AUTO, gap: AUTO },
      auto: new Set(['bins', 'gap']),
      reported: new Map<string, unknown>([
        ['bins', 42],
        ['gap', 7],
      ]),
    } as unknown as TrialChromeContext;
    expect(JSON.parse(settingsJson(ctx))).toEqual({ bins: 42, gap: 7 });
  });
});
