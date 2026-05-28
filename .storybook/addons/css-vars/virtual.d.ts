// Type declarations for the `virtual:weasel-tokens` module emitted by
// `scripts/vite-plugin-weasel-tokens.ts`.
declare module 'virtual:weasel-tokens' {
  export interface Token {
    readonly name: string;
    readonly defaultValue: string;
    readonly group: string;
  }
  const tokens: readonly Token[];
  export default tokens;
}
