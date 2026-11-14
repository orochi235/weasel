import { describe, expect, it } from 'vitest';
import { pathAidsToGroup, renamePathAids } from './prefsMigration';

describe('path aid migrations', () => {
  it('carries a version 2 balance and corners toggle through to Poise and Fillet', () => {
    const records = new Map<string, unknown>([
      ['view.pathBalance', false],
      ['view.pathCorners', true],
    ]);
    pathAidsToGroup(records as never);
    renamePathAids(records as never);
    expect(Object.fromEntries(records)).toEqual({
      'view.pathEditing.pathPoise': false,
      'view.pathEditing.pathFillets': true,
    });
  });

  it('keeps a value already stored under the new name', () => {
    const records = new Map<string, unknown>([
      ['view.pathEditing.pathCorners', false],
      ['view.pathEditing.pathFillets', true],
    ]);
    renamePathAids(records as never);
    expect(Object.fromEntries(records)).toEqual({ 'view.pathEditing.pathFillets': true });
  });
});
