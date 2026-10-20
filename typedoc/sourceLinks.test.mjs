import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { sourceLinkOptions, sourceLinkTemplate } from './sourceLinks.mjs';

describe('sourceLinkTemplate', () => {
  it('reads a GitHub repository from the manifest URL forms npm writes', () => {
    const template = 'https://github.com/orochi235/weasel/blob/{gitRevision}/{path}#L{line}';
    expect(sourceLinkTemplate('git+https://github.com/orochi235/weasel.git')).toBe(template);
    expect(sourceLinkTemplate('https://github.com/orochi235/weasel')).toBe(template);
    expect(sourceLinkTemplate('git@github.com:orochi235/weasel.git')).toBe(template);
    expect(sourceLinkTemplate('github:orochi235/weasel')).toBe(template);
  });

  it('refuses a host it cannot write a link for', () => {
    expect(() => sourceLinkTemplate('https://example.com/x/y.git')).toThrow(/example\.com/);
  });
});

describe('sourceLinkOptions', () => {
  it('links every file without asking git which ones it tracks, at the checked-out commit', () => {
    const root = import.meta.dirname;
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    expect(sourceLinkOptions(`${root}/..`)).toEqual({
      disableGit: true,
      gitRevision: head,
      sourceLinkTemplate: 'https://github.com/orochi235/weasel/blob/{gitRevision}/{path}#L{line}',
    });
  });
});
