import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../../..');
const fixture = resolve(__dirname, 'declarationEmit.fixture.ts');

/** Emits declarations for one file under the root tsconfig and returns every diagnostic, formatted. */
function declarationDiagnostics(file: string): string[] {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    resolve(root, 'tsconfig.json'),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (d) => {
        throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
      },
    },
  );
  if (!parsed) throw new Error('could not read the root tsconfig');
  const options: ts.CompilerOptions = {
    ...parsed.options,
    noEmit: false,
    declaration: true,
    emitDeclarationOnly: true,
    declarationMap: false,
    sourceMap: false,
    incremental: false,
    tsBuildInfoFile: undefined,
    types: [],
  };
  const program = ts.createProgram({ rootNames: [file], options });
  const source = program.getSourceFile(file);
  if (!source) throw new Error(`${file} is not in the program`);
  const emitted = program.emit(source, () => {}, undefined, true);
  const diagnostics = [
    ...program.getSyntacticDiagnostics(source),
    ...program.getSemanticDiagnostics(source),
    ...emitted.diagnostics,
  ];
  return diagnostics.map((d) => {
    const text = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    return d.file ? `${d.file.fileName}: TS${d.code} ${text}` : `TS${d.code} ${text}`;
  });
}

describe('config schema declarations', () => {
  it('emit for exported schemas, groups and nodes', () => {
    expect(declarationDiagnostics(fixture)).toEqual([]);
  }, 60_000);
});
