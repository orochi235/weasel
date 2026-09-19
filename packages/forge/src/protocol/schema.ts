import {
  f,
  isConfigBranch,
  resolveConfigSchema,
  schemaNodeAtPath,
  type Annotations,
  type BranchAnnotations,
  type ConfigBranch,
  type ConfigEntry,
  type ConfigNode,
  type ConfigSchema,
  type ConfigShape,
  type NodeOptions,
} from '@weasel-js/labkit/config';

export interface SectionDescription {
  label: string;
  collapsed?: boolean;
}

export type DescribedEntry =
  | {
      branch: true;
      annotations: BranchAnnotations;
      section?: SectionDescription;
      conditional: boolean;
      children: DescribedShape;
    }
  | {
      branch: false;
      kind: string | null;
      default: unknown;
      annotations: Annotations;
      section?: SectionDescription;
      conditional: boolean;
      validated: boolean;
      /** The node draws its own row with `.render`, which stays in the frame. */
      customControl: boolean;
    };

export type DescribedShape = { [key: string]: DescribedEntry };

/** A story's `f.schema` as structured-clone data. */
export interface SchemaDescription {
  nodes: DescribedShape;
}

/** Answers the workshop has for the rebuilt schema's predicates. */
export interface SchemaAnswers {
  hidden(path: string, config: unknown): boolean;
  errors(path: string, config: unknown): string[];
}

const joinPath = (at: string, key: string): string => (at === '' ? key : `${at}.${key}`);

function describeShape(shape: ConfigShape): DescribedShape {
  const out: DescribedShape = {};
  for (const [key, entry] of Object.entries(shape)) {
    const { section, showIf } = entry.options;
    const common = {
      annotations: { ...entry.annotations },
      ...(section === undefined ? {} : { section: { ...section } }),
      conditional: showIf !== undefined,
    };
    out[key] = isConfigBranch(entry)
      ? { branch: true, ...common, children: describeShape(entry.children) }
      : {
          branch: false,
          kind: entry.kind,
          default: entry.default,
          ...common,
          validated: entry.options.validate !== undefined,
          customControl: entry.options.render !== undefined,
        };
  }
  return out;
}

export function describeSchema(schema: ConfigSchema<unknown>): SchemaDescription {
  return { nodes: describeShape(schema.nodes) };
}

function rebuildShape(shape: DescribedShape, at: string, answers: SchemaAnswers): ConfigShape {
  const out: Record<string, ConfigEntry> = {};
  for (const [key, entry] of Object.entries(shape)) {
    const path = joinPath(at, key);
    const options: NodeOptions = {
      ...(entry.section === undefined ? {} : { section: entry.section }),
      ...(entry.conditional ? { showIf: (config) => !answers.hidden(path, config) } : {}),
    };
    if (entry.branch) {
      const branch: ConfigBranch = {
        children: rebuildShape(entry.children, path, answers),
        annotations: entry.annotations,
        options,
      };
      out[key] = branch;
    } else {
      const node: ConfigNode = {
        kind: entry.kind,
        default: entry.default,
        annotations: entry.annotations,
        options: entry.validated ? { ...options, validate: (_leaf, config) => answers.errors(path, config) } : options,
      };
      out[key] = node;
    }
  }
  return out;
}

export function schemaFromDescription(
  description: SchemaDescription,
  answers: SchemaAnswers,
): ConfigSchema<unknown> {
  return f.schema(rebuildShape(description.nodes, '', answers)) as ConfigSchema<unknown>;
}

/** Evaluate a schema's own predicates for one config — the frame's half of `answers`. */
export function answerSchema(
  schema: ConfigSchema<unknown>,
  config: unknown,
): { hidden: string[]; errors: Record<string, string[]> } {
  const hidden: string[] = [];
  const errors: Record<string, string[]> = {};
  const record = config as Record<string, unknown>;
  let group: ReturnType<typeof resolveConfigSchema>['group'] | undefined;

  const walk = (shape: ConfigShape, at: string): void => {
    for (const [key, entry] of Object.entries(shape)) {
      const path = joinPath(at, key);
      if (entry.options.showIf && !entry.options.showIf(record)) hidden.push(path);
      if (isConfigBranch(entry)) {
        walk(entry.children, path);
        continue;
      }
      const { validate } = entry.options;
      if (!validate) continue;
      group ??= resolveConfigSchema(schema).group;
      const leaf = schemaNodeAtPath(group, path);
      if (!leaf || 'children' in leaf) continue;
      const found = validate(leaf, record);
      if (found.length > 0) errors[path] = found;
    }
  };
  walk(schema.nodes, '');
  return { hidden, errors };
}
