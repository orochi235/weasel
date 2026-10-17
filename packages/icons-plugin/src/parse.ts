import { parseSync, type ParseResult } from 'oxc-parser';

type Lang = 'js' | 'jsx' | 'ts' | 'tsx';

/** The grammar a module id's extension names; anything unrecognized parses as JS. */
export function langOf(id: string): Lang {
  const m = /\.[cm]?([jt])s(x?)$/.exec(id);
  if (!m) return 'js';
  return `${m[1]}s${m[2]}` as Lang;
}

/** `code` parsed as an ES module, or the first error when it does not parse cleanly. */
export function parseModule(code: string, id: string): ParseResult | { error: string } {
  const result = parseSync(id, code, { lang: langOf(id), sourceType: 'module' });
  return result.errors.length > 0 ? { error: result.errors[0]!.message } : result;
}
