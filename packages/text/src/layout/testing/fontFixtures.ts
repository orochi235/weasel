import { vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import type { ResolvedRun } from '../../runs/resolveRuns';

export function stubFetch() {
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
    }
    if (url.endsWith('.png')) {
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  }) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
}

export async function registerFixture(family: string, opts: Array<{ weight?: number; style?: 'normal'|'italic' }>) {
  for (const v of opts) {
    await registerFont(family, v, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
  }
}

// A second atlas whose baseline sits lower in the same em, so a face's ascent
// can be varied without varying its size — which is what separates "the line
// sank its baseline to clear this face" from "the run is set larger".
export const TALL_FONT = { ...FIXTURE_FONT, common: { ...FIXTURE_FONT.common, base: 58 } };
export async function registerTallFont(): Promise<void> {
  const prior = global.fetch;
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('tall.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(TALL_FONT) });
    }
    return (prior as unknown as (u: string) => unknown)(url);
  }) as typeof fetch;
  await registerFont('tall', {}, '/fonts/tall/tall.json', '/fonts/tall/tall.png');
  global.fetch = prior;
}

export const RUN_PLAIN = (text: string): ResolvedRun => ({
  text, fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
  fill: { paint: { kind: 'solid', color: '#000' } }, letterSpacing: 0,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
});
export const RUN_BOLD = (text: string): ResolvedRun => ({ ...RUN_PLAIN(text), fontWeight: 700 });
export const RUN_ITALIC = (text: string): ResolvedRun => ({ ...RUN_PLAIN(text), fontStyle: 'italic' });
