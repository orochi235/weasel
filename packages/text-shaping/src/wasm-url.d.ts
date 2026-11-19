/** A `?url` import: the URL a bundler serves the file at. */
declare module '*.wasm?url' {
  const url: string;
  export default url;
}
