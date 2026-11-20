import { describe, expect, it } from 'vitest';
import { fixShell, matchShell, reviewShell } from './jobs.mjs';

const claudeOf = (shell: string) => shell.split(/ && |\n/).find((part) => part.includes('claude -p'))!;

describe('job command lines', () => {
  it("start every job without the user's settings, naming the model and effort those settings gave", () => {
    const review = claudeOf(reviewShell('core', 8));
    const fix = claudeOf(fixShell('core', 15, 3));
    const match = claudeOf(matchShell('core', 1));
    for (const line of [review, fix, match]) expect(line).toContain('--strict-mcp-config --setting-sources project,local');
    expect(review).toContain('--model opus --effort medium');
    expect(fix).toContain('--model opus --effort medium');
    expect(match).toContain('--model haiku');
  });
});
