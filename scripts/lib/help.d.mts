export interface CliOption {
  type: 'boolean' | 'string';
  short?: string;
  multiple?: boolean;
  default?: boolean | string | boolean[] | string[];
  placeholder?: string;
  description: string;
}
export interface CliSpec {
  /** What the usage line calls the command; `node <path>` when left out. */
  name?: string;
  summary: string;
  positionals?: string;
  options?: Record<string, CliOption>;
  passthrough?: boolean;
  notes?: string;
  commands?: Record<string, Omit<CliSpec, 'commands'>>;
}
export interface CliParse {
  command?: string;
  values: Record<string, boolean | string | Array<boolean | string> | undefined>;
  positionals: string[];
  rest: string[];
}
export function usageLineOf(name: string, spec: CliSpec): string;
export function helpOf(name: string, spec: CliSpec): string;
export function parseCli(name: string, spec: CliSpec, argv: string[]): { help: string } | { error: string } | CliParse;
export function cli(url: string, spec: CliSpec, argv?: string[]): CliParse;
