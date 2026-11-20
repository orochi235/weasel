import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cameHome } from './area.mjs';

const dirs: string[] = [];
const job = (files: Record<string, string>) => {
  const to = mkdtempSync(join(tmpdir(), 'skulk-job-'));
  dirs.push(to);
  mkdirSync(to, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(to, name), text);
  return { to };
};
const ok = JSON.stringify({ type: 'result', is_error: false, result: 'done', total_cost_usd: 1 });
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('cameHome', () => {
  it('reuses a fixer that exited with a reply and an mbox', () => {
    expect(cameHome(job({ exit: '0', 'claude.json': ok, 'fix.mbox': '' }), 'fix')).toBeDefined();
  });
  it('runs again a job with no exit, an error reply, or a fixer with no mbox', () => {
    expect(cameHome(job({ 'claude.json': ok, 'fix.mbox': '' }), 'fix')).toBeUndefined();
    expect(cameHome(job({ exit: '1', 'claude.json': ok.replace('"is_error":false', '"is_error":true') }), 'match')).toBeUndefined();
    expect(cameHome(job({ exit: '0', 'claude.json': ok }), 'fix')).toBeUndefined();
  });
  it('runs again a review that never reached its done line', () => {
    expect(cameHome(job({ exit: '0', 'claude.json': ok, 'findings.md': '1. a finding\n' }), 'review-A')).toBeUndefined();
  });
});
