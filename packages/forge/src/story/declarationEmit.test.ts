import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../../..');
const fixture = resolve(__dirname, 'declarationEmit.fixture.ts');

function emitDeclarations(file: string): { diagnostics: string[]; dts: string } {
  const parsed = ts.getParsedCommandLineOfConfigFile(resolve(root, 'tsconfig.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    },
  });
  if (!parsed) throw new Error('could not read the root tsconfig');
  const program = ts.createProgram({
    rootNames: [file],
    options: {
      ...parsed.options,
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      declarationMap: false,
      sourceMap: false,
      incremental: false,
      tsBuildInfoFile: undefined,
      types: [],
    },
  });
  const source = program.getSourceFile(file);
  if (!source) throw new Error(`${file} is not in the program`);
  let dts = '';
  const emitted = program.emit(source, (_, text) => (dts = text), undefined, true);
  const diagnostics = [
    ...program.getSyntacticDiagnostics(source),
    ...program.getSemanticDiagnostics(source),
    ...emitted.diagnostics,
  ].map((d) => `TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
  return { diagnostics, dts };
}

describe('story declarations', () => {
  it('emit for an exported story with a grouped config', () => {
    const { diagnostics, dts } = emitDeclarations(fixture);
    expect(diagnostics).toEqual([]);
    expect(dts).toContain('export declare const Grouped');
  }, 60_000);
});
