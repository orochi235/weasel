import type { BrowserProviderOption } from 'vitest/node';
import type { PlaywrightProviderOptions } from '@vitest/browser-playwright';

export function spreadPlaywright(options: PlaywrightProviderOptions, count: number): BrowserProviderOption<PlaywrightProviderOptions>;
export function browserShape(cores: number, env?: Record<string, string | undefined>): { chromiums: number; tabs: number };
