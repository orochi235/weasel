export interface Traits {
  react: 'needs' | 'optional' | 'none';
  dom: boolean;
  webgl2: boolean;
  webaudio: boolean;
  standalone: boolean;
}
export function renderReadme(readme: string, traits: Map<string, Traits>): string;
