/** One check `csf.mjs` runs; `frame` is the story host's Playwright locator and `page` the workshop page. */
export interface CsfCheck {
  id: string;
  what: string;
  colorScheme?: 'light' | 'dark';
  check(ctx: { frame: unknown; page: unknown }): Promise<void>;
}

export const smokeStory: string;
export const csfChecks: CsfCheck[];
export function csfShot(dir: string, index: number, id: string): string;
