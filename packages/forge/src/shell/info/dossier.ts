import type { Instrument } from '@weasel-js/labkit';
import { type ConfigNode, type ConfigShape, isConfigBranch, valueAtPath } from '@weasel-js/labkit/config';
import type { IndexEntry } from '../../story/types';
import { libraryOf } from '../tree/buildComponents';

/** One prop of the story, as the dossier prints it. */
export interface DossierArg {
  /** Dotted path within the schema — what the value is written at. */
  path: string;
  /** The author's `argTypes` name, else the path's last segment. */
  label: string;
  /** The control kind labkit resolved, or null while rules have not run. */
  kind: string | null;
  default: unknown;
  /** The focused trial's value, which is `default` until someone edits it. */
  value: unknown;
  description?: string;
}

/** Everything Get Info prints about one story. */
export interface Dossier {
  id: string;
  title: string;
  name: string;
  exportName: string;
  file: string;
  /** Which package the story file lives in. */
  library: string;
  componentName?: string;
  description?: string;
  componentDescription?: string;
  args: DossierArg[];
  /** The story's frame has not reported its schema yet, so an empty `args`
   *  means "not loaded" rather than "takes none". */
  argsPending: boolean;
}

/** The group forge hides the lab's globals in. Those are the lab's settings,
 *  not the story's props, and the dossier is about the story. */
const GLOBALS = '$globals';

/** Every visible leaf of `shape`, depth first, carrying its dotted path. */
function leaves(shape: ConfigShape, prefix = ''): { path: string; node: ConfigNode }[] {
  const out: { path: string; node: ConfigNode }[] = [];
  for (const [key, entry] of Object.entries(shape)) {
    if (prefix === '' && key === GLOBALS) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (isConfigBranch(entry)) out.push(...leaves(entry.children, path));
    else if (!entry.annotations.hidden) out.push({ path, node: entry });
  }
  return out;
}

/**
 * The dossier for one story. A pure function of the records the shell already
 * holds: the index entry, the instrument built from the story's `ready`
 * message, and the focused trial's config. An instrument exists before its
 * frame reports anything, and its schema is empty until then — so `ready`
 * decides whether an empty `args` reads as pending or as none.
 */
export function storyDossier(input: {
  entry: IndexEntry;
  instrument?: Instrument<unknown, unknown> | undefined;
  config?: unknown;
  ready?: boolean;
}): Dossier {
  const { entry, instrument, config, ready = true } = input;
  const schema = ready ? instrument?.config : undefined;
  const args = schema
    ? leaves(schema.nodes).map(({ path, node }): DossierArg => {
        const value = valueAtPath(config, path);
        return {
          path,
          label: node.annotations.name ?? path.split('.').pop() ?? path,
          kind: node.kind,
          default: node.default,
          value: value === undefined ? node.default : value,
          ...(node.annotations.description === undefined
            ? {}
            : { description: node.annotations.description }),
        };
      })
    : [];
  return {
    id: entry.id,
    title: entry.title,
    name: entry.name,
    exportName: entry.exportName,
    file: entry.file,
    library: libraryOf(entry),
    ...(entry.componentName === undefined ? {} : { componentName: entry.componentName }),
    ...(entry.description === undefined ? {} : { description: entry.description }),
    ...(entry.componentDescription === undefined
      ? {}
      : { componentDescription: entry.componentDescription }),
    args,
    argsPending: !schema,
  };
}
