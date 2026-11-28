import { describe, expect, it, vi } from 'vitest';
import { virtualModules } from './virtualModules.ts';

vi.mock('node:path', async (actual) => {
  const path = await actual<typeof import('node:path')>();
  return { ...path.win32, default: path.win32 };
});

describe('virtualModules on Windows', () => {
  it('imports config modules and frame styles by the slashed path vite writes for their ids', () => {
    const modules = virtualModules(
      { stories: [], frameConfig: 'forge.frame.ts', shellConfig: 'forge.shell.ts', frameStyles: ['src/frame.css'] },
      { index: () => [], files: () => new Map(), root: () => 'C:\\app', base: () => '/' },
    );
    expect(modules['frame-config.js']!()).toContain('"C:/app/forge.frame.ts"');
    expect(modules['shell-config.js']!()).toContain('"C:/app/forge.shell.ts"');
    expect(modules['frame-entry.js']!()).toContain('C:/app/src/frame.css');
    expect(modules['frame-entry.js']!()).not.toContain('\\\\');
  });
});
