import { dirname } from 'node:path';
import type ts from 'typescript';
import type { ArgType } from '../csf/argsToSchema.ts';

/** What a story file's component takes, as argTypes, and the files its props are declared in. */
export interface PropTable {
  argTypes: Record<string, ArgType>;
  sources: string[];
}

export interface PropReader {
  /** The props of the component `file`'s default export names; null when it names none. */
  read(file: string): PropTable | null;
}

const IN_PACKAGE = /[\\/]node_modules[\\/]/;

/**
 * Reads component props through the project's own TypeScript, so a prop's type is what the compiler resolves it to.
 * `stories` are the program's roots, named up front so the program is built once. Null without `typescript`.
 */
export async function createPropReader(root: string, stories: () => readonly string[]): Promise<PropReader | null> {
  let tsm: typeof ts;
  try {
    tsm = (await import('typescript')).default;
  } catch {
    return null;
  }
  const { sys } = tsm;
  const configFile = tsm.findConfigFile(root, sys.fileExists);
  const read = configFile ? tsm.readConfigFile(configFile, sys.readFile) : undefined;
  const parsed = read?.config
    ? tsm.parseJsonConfigFileContent(read.config, { ...sys, readDirectory: () => [] }, dirname(configFile!))
    : undefined;
  const options: ts.CompilerOptions = {
    jsx: tsm.JsxEmit.ReactJSX,
    moduleResolution: tsm.ModuleResolutionKind.Bundler,
    module: tsm.ModuleKind.ESNext,
    target: tsm.ScriptTarget.ESNext,
    strict: true,
    ...parsed?.options,
    allowJs: true,
    noEmit: true,
    skipLibCheck: true,
  };
  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => [...stories()],
    getScriptVersion: (file) => String(sys.getModifiedTime?.(file)?.getTime() ?? 0),
    getScriptSnapshot: (file) => {
      const text = sys.readFile(file);
      return text === undefined ? undefined : tsm.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => root,
    getCompilationSettings: () => options,
    getDefaultLibFileName: tsm.getDefaultLibFilePath,
    fileExists: sys.fileExists,
    readFile: sys.readFile,
    readDirectory: sys.readDirectory,
    directoryExists: sys.directoryExists,
    getDirectories: sys.getDirectories,
  };
  const service = tsm.createLanguageService(host, tsm.createDocumentRegistry());

  return {
    read(file) {
      const program = service.getProgram();
      const source = program?.getSourceFile(file);
      if (!program || !source) return null;
      const checker = program.getTypeChecker();
      const props = componentProps(tsm, checker, source);
      return props ? propTable(tsm, checker, props, source) : null;
    },
  };
}

/** The props type of the `component` a story file's default export names. */
function componentProps(tsm: typeof ts, checker: ts.TypeChecker, source: ts.SourceFile): ts.Type | null {
  const module = checker.getSymbolAtLocation(source);
  const exported = module && checker.tryGetMemberInModuleExports('default', module);
  if (!exported) return null;
  const meta = checker.getTypeOfSymbolAtLocation(
    exported.flags & tsm.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported,
    source,
  );
  const named = meta.getProperty('component');
  if (!named) return null;
  const component = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(named, source));
  for (const part of component.isUnion() ? component.types : [component]) {
    const [call] = part.getCallSignatures();
    const [param] = call?.getParameters() ?? [];
    if (call) return param ? checker.getTypeOfSymbolAtLocation(param, source) : null;
    const instance = part.getConstructSignatures()[0]?.getReturnType();
    const held = instance?.getProperty('props');
    if (held) return checker.getTypeOfSymbolAtLocation(held, source);
  }
  return null;
}

/** An argType for each prop a control can edit: a boolean, a string, a number, or a union of string literals. */
function propTable(tsm: typeof ts, checker: ts.TypeChecker, props: ts.Type, at: ts.SourceFile): PropTable {
  const argTypes: Record<string, ArgType> = {};
  const sources = new Set<string>();
  for (const prop of checker.getPropertiesOfType(checker.getApparentType(props))) {
    const files = (prop.getDeclarations() ?? []).map((declaration) => declaration.getSourceFile().fileName);
    // What a package declares is the platform's surface, every DOM attribute included, and not the component's own.
    if (files.length > 0 && files.every((file) => IN_PACKAGE.test(file))) continue;
    const argType = controlFor(tsm, checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(prop, at)));
    if (!argType) continue;
    const description = tsm.displayPartsToString(prop.getDocumentationComment(checker)).replace(/\s+/g, ' ').trim();
    argTypes[prop.getName()] = description ? { ...argType, description } : argType;
    for (const file of files) if (!IN_PACKAGE.test(file)) sources.add(file);
  }
  return { argTypes, sources: [...sources] };
}

function controlFor(tsm: typeof ts, type: ts.Type): ArgType | null {
  const { TypeFlags } = tsm;
  const parts = type.isUnion() ? type.types : [type];
  const every = (flags: ts.TypeFlags) => parts.every((part) => part.flags & flags);
  if (every(TypeFlags.BooleanLike)) return { control: { type: 'boolean' } };
  if (type.flags & TypeFlags.String) return { control: { type: 'text' } };
  if (type.flags & TypeFlags.Number) return { control: { type: 'number' } };
  // No control type: the options alone make it a select, and a story's own argType may still say radio.
  if (parts.length > 1 && every(TypeFlags.StringLiteral)) {
    return { options: parts.map((part) => (part as ts.StringLiteralType).value) };
  }
  return null;
}
