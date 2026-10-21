import { resolve } from 'node:path';
import type { IndexEntry } from '../story/types.ts';
import { captureEntry, captureFrameEntry } from './capture/entries.ts';
import { frameEntry, shellEntry } from './entries.ts';

export const PREFIX = 'virtual:forge/';

/** Every `virtual:forge/*` module name; `deps.js` is built apart, since it needs the resolver. */
export const MODULES = new Set([
  'index.js',
  'importers.js',
  'deps.js',
  'frame-config.js',
  'shell-config.js',
  'shell-entry.js',
  'frame-entry.js',
  'capture-entry.js',
  'capture-frame-entry.js',
]);

/** The plugin options the modules are written from. */
export interface VirtualModuleOptions {
  stories: readonly string[];
  frameConfig?: string | undefined;
  shellConfig?: string | undefined;
  frameStyles?: readonly string[] | undefined;
}

/** The plugin state the modules are read from, each read when a module loads. */
export interface VirtualModuleState {
  index(): IndexEntry[];
  /** Story files, each with its entries; a file that failed to parse has none. */
  files(): Map<string, IndexEntry[]>;
  root(): string;
  base(): string;
}

/** The source of every virtual module but `deps.js`, by name. */
export function virtualModules(options: VirtualModuleOptions, src: VirtualModuleState): Record<string, () => string> {
  const configModule = (path: string | undefined) =>
    path ? `export { default } from ${JSON.stringify(resolve(src.root(), path))};\n` : 'export default {};\n';
  const frameStyles = () => (options.frameStyles ?? []).map((path) => resolve(src.root(), path));
  return {
    'index.js': () => `export default ${JSON.stringify(src.index())};\n`,
    'importers.js': () => {
      const lines = [...src.files()]
        .filter(([, entries]) => entries.length > 0)
        .map(([file]) => `  ${JSON.stringify(file)}: () => import(${JSON.stringify(file)}),`);
      return `export default {\n${lines.join('\n')}\n};\n`;
    },
    'frame-config.js': () => configModule(options.frameConfig),
    'shell-config.js': () => configModule(options.shellConfig),
    'shell-entry.js': () => shellEntry(src.base(), options.stories),
    'frame-entry.js': () => frameEntry(frameStyles()),
    'capture-entry.js': () => captureEntry(),
    'capture-frame-entry.js': () => captureFrameEntry(frameStyles()),
  };
}
