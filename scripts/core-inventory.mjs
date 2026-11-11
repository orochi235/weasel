#!/usr/bin/env node
/**
 * Every public export of `@weasel-js/core`, entry point by entry point, with its kind. The
 * inventory is checked in at `packages/core/exports.inventory.json`; `core-inventory.test.ts`
 * fails when the source exports something it does not list, or stops exporting something it does.
 *
 * Usage: `npm run inventory:core` reports the difference and exits 1 on one;
 * `npm run inventory:core -- --update` rewrites the inventory to match the source.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { entries } from '../packages/core/entries.ts';

const ROOT = join(import.meta.dirname, '..');
const CORE = join(ROOT, 'packages', 'core');
export const INVENTORY = join(CORE, 'exports.inventory.json');

/** Each `exports` subpath with declarations, mapped to the source file its `dist/<key>` is built from. */
export function entryPoints() {
  const pkg = JSON.parse(readFileSync(join(CORE, 'package.json'), 'utf8'));
  const out = {};
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    const types = typeof target === 'object' ? target.types : undefined;
    if (!types) continue;
    const key = /^\.\/dist\/(.+)\.d\.ts$/.exec(types)?.[1];
    const source = key && entries[key];
    if (!source) throw new Error(`core-inventory: ${subpath} names ${types}, which no entry in entries.ts builds`);
    out[subpath] = join(CORE, source);
  }
  return out;
}

const isTypeOnlyDecl = (decl) =>
  (ts.isExportSpecifier(decl) && (decl.isTypeOnly || decl.parent.parent.isTypeOnly)) ||
  (ts.isImportSpecifier(decl) && (decl.isTypeOnly || decl.parent.parent.isTypeOnly)) ||
  (ts.isImportClause(decl) && decl.isTypeOnly) ||
  (ts.isNamespaceExport(decl) && decl.parent.isTypeOnly);

function kindOf(checker, symbol) {
  let typeOnly = false;
  let s = symbol;
  while (s.flags & ts.SymbolFlags.Alias) {
    if (s.declarations?.some(isTypeOnlyDecl)) typeOnly = true;
    const next = checker.getImmediateAliasedSymbol(s);
    if (!next || next === s) break;
    s = next;
  }
  const f = s.flags;
  if (typeOnly || !(f & ts.SymbolFlags.Value)) return 'type';
  if (f & ts.SymbolFlags.Class) return 'class';
  if (f & ts.SymbolFlags.Function) return 'function';
  if (f & ts.SymbolFlags.Enum) return 'enum';
  if (f & ts.SymbolFlags.ValueModule) return 'namespace';
  if (f & ts.SymbolFlags.Variable) {
    const decl = s.valueDeclaration;
    const list = decl && ts.isVariableDeclaration(decl) ? decl.parent : undefined;
    return list && list.flags & ts.NodeFlags.Const ? 'const' : 'let';
  }
  return 'value';
}

/** `{ subpath: { name: kind } }`, every level sorted. */
export function collectInventory() {
  const points = entryPoints();
  const config = ts.getParsedCommandLineOfConfigFile(join(CORE, 'tsconfig.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    },
  });
  const program = ts.createProgram({
    rootNames: Object.values(points),
    options: { ...config.options, noEmit: true, skipLibCheck: true, types: [] },
  });
  const checker = program.getTypeChecker();
  const out = {};
  for (const subpath of Object.keys(points).sort()) {
    const sf = program.getSourceFile(points[subpath]);
    const moduleSymbol = sf && checker.getSymbolAtLocation(sf);
    if (!moduleSymbol) throw new Error(`core-inventory: ${points[subpath]} did not load as a module`);
    const names = checker
      .getExportsOfModule(moduleSymbol)
      .map((symbol) => [symbol.escapedName.toString(), kindOf(checker, symbol)])
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    out[subpath] = Object.fromEntries(names);
  }
  return out;
}

/** What changed from `recorded` to `actual`, one line per name, or `[]` when they match. */
export function diffInventory(recorded, actual) {
  const lines = [];
  for (const subpath of [...new Set([...Object.keys(recorded), ...Object.keys(actual)])].sort()) {
    const was = recorded[subpath] ?? {};
    const now = actual[subpath] ?? {};
    for (const name of [...new Set([...Object.keys(was), ...Object.keys(now)])].sort()) {
      const at = `${subpath === '.' ? '@weasel-js/core' : `@weasel-js/core/${subpath.slice(2)}`} ${name}`;
      if (!(name in was)) lines.push(`+ ${at} (${now[name]})`);
      else if (!(name in now)) lines.push(`- ${at} (${was[name]})`);
      else if (was[name] !== now[name]) lines.push(`~ ${at} (${was[name]} -> ${now[name]})`);
    }
  }
  return lines;
}

export const formatInventory = (inventory) => `${JSON.stringify(inventory, null, 2)}\n`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const actual = collectInventory();
  const recorded = existsSync(INVENTORY) ? JSON.parse(readFileSync(INVENTORY, 'utf8')) : {};
  const diff = diffInventory(recorded, actual);
  if (process.argv.includes('--update')) {
    writeFileSync(INVENTORY, formatInventory(actual));
    const total = Object.values(actual).reduce((n, names) => n + Object.keys(names).length, 0);
    console.log(`inventory:core — written, ${total} exports across ${Object.keys(actual).length} entry points.`);
    if (diff.length > 0) console.log(diff.join('\n'));
  } else if (diff.length > 0) {
    console.error(`inventory:core — core's exports differ from the inventory:\n${diff.join('\n')}\n\n` +
      'Run `npm run inventory:core -- --update` if the change is intended.');
    process.exit(1);
  } else {
    console.log('inventory:core — every export matches the inventory.');
  }
}
