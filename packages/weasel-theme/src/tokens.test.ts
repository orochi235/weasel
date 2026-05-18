import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TOKENS } from './tokens';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('weasel-theme tokens', () => {
  it('DEFAULT_TOKENS keys match tokens.css :root declarations', () => {
    const cssText = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');
    const matches = [...cssText.matchAll(/(--wzl-[a-z0-9-]+):\s*([^;]+);/g)];
    // Dedupe: light-theme overrides legitimately redeclare some tokens under
    // `[data-theme='light']`. We're checking key parity, not declaration count.
    const cssKeys = [...new Set(matches.map(([, key]) => key))].sort();
    const tsKeys = Object.keys(DEFAULT_TOKENS).sort();
    expect(cssKeys).toEqual(tsKeys);
  });
});
