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

/** React's own declarations and TypeScript's libraries: every DOM attribute and event handler an element takes. */
const PLATFORM = /[\\/]node_modules[\\/](@types[\\/]react(-dom)?|typescript)[\\/]/;

/** Narrows which props get a control. */
export interface PropControlsOptions {
  /**
   * Leaves out a prop declared in a file this answers true for, given the file's absolute path. Props that React's
   * types or TypeScript's libraries declare are always left out.
   */
  skip?: (declaredIn: string) => boolean;
}

/**
 * Reads component props through the project's own TypeScript, so a prop's type is what the compiler resolves it to.
 * `stories` are the program's roots, named up front so the program is built once. Null without `typescript`.
 */
export async function createPropReader(
  root: string,
  stories: () => readonly string[],
  { skip }: PropControlsOptions = {},
): Promise<PropReader | null> {
  const skipped = (file: string) => PLATFORM.test(file) || skip?.(file) === true;
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
      return props ? propTable(tsm, checker, props, source, skipped) : null;
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
function propTable(
  tsm: typeof ts,
  checker: ts.TypeChecker,
  props: ts.Type,
  at: ts.SourceFile,
  skipped: (file: string) => boolean,
): PropTable {
  const argTypes: Record<string, ArgType> = {};
  const sources = new Set<string>();
  for (const prop of checker.getPropertiesOfType(checker.getApparentType(props))) {
    const files = (prop.getDeclarations() ?? []).map((declaration) => declaration.getSourceFile().fileName);
    if (files.length > 0 && files.every(skipped)) continue;
    const argType = controlFor(tsm, checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(prop, at)), () =>
      writtenOrder(tsm, checker, prop),
    );
    if (!argType) continue;
    const description = tsm.displayPartsToString(prop.getDocumentationComment(checker)).replace(/\s+/g, ' ').trim();
    argTypes[prop.getName()] = description ? { ...argType, description } : argType;
    for (const file of files) if (!/[\\/]node_modules[\\/]/.test(file)) sources.add(file);
  }
  return { argTypes, sources: [...sources] };
}

function controlFor(tsm: typeof ts, type: ts.Type, written: () => string[] | null): ArgType | null {
  const { TypeFlags } = tsm;
  const parts = type.isUnion() ? type.types : [type];
  const every = (flags: ts.TypeFlags) => parts.every((part) => part.flags & flags);
  if (every(TypeFlags.BooleanLike)) return { control: { type: 'boolean' } };
  if (type.flags & TypeFlags.String) return { control: { type: 'text' } };
  if (type.flags & TypeFlags.Number) return { control: { type: 'number' } };
  // No control type: the options alone make it a select, and a story's own argType may still say radio.
  if (parts.length > 1 && every(TypeFlags.StringLiteral)) {
    const options = parts.map((part) => (part as ts.StringLiteralType).value);
    const order = written();
    const same = order?.length === options.length && options.every((option) => order.includes(option));
    return { options: same ? order : options };
  }
  return null;
}

/**
 * A prop's string literals in the order its type is written in, following a plain alias to where it is spelled out.
 * Null when any part of the type is computed.
 */
function writtenOrder(tsm: typeof ts, checker: ts.TypeChecker, prop: ts.Symbol): string[] | null {
  const [declaration, ...others] = prop.getDeclarations() ?? [];
  if (!declaration || others.length > 0) return null;
  if (!tsm.isPropertySignature(declaration) && !tsm.isPropertyDeclaration(declaration)) return null;
  const seen = new Set<ts.Node>();
  const literals = (node: ts.TypeNode | undefined): string[] | null => {
    if (!node || seen.has(node)) return null;
    seen.add(node);
    if (tsm.isParenthesizedTypeNode(node)) return literals(node.type);
    if (tsm.isLiteralTypeNode(node)) {
      if (node.literal.kind === tsm.SyntaxKind.NullKeyword) return [];
      return tsm.isStringLiteralLike(node.literal) ? [node.literal.text] : null;
    }
    if (node.kind === tsm.SyntaxKind.UndefinedKeyword) return [];
    if (tsm.isUnionTypeNode(node)) {
      const parts = node.types.map(literals);
      return parts.every((part) => part !== null) ? [...new Set(parts.flat())] : null;
    }
    if (tsm.isTypeReferenceNode(node) && !node.typeArguments) {
      const named = checker.getSymbolAtLocation(node.typeName);
      const target = named && named.flags & tsm.SymbolFlags.Alias ? checker.getAliasedSymbol(named) : named;
      const [alias, ...rest] = target?.getDeclarations() ?? [];
      if (alias && rest.length === 0 && tsm.isTypeAliasDeclaration(alias) && !alias.typeParameters) {
        return literals(alias.type);
      }
    }
    return null;
  };
  return literals(declaration.type);
}
