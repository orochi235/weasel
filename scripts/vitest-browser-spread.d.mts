import type { BrowserProviderOption } from 'vitest/node';
import type { PlaywrightProviderOptions } from '@vitest/browser-playwright';

export function spreadPlaywright(options: PlaywrightProviderOptions, count: number): BrowserProviderOption<PlaywrightProviderOptions>;
