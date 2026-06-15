// Ambient module decls for non-JS imports used by the preview (labkit ships
// `.less` styles and `?url` font assets). Vite resolves these at build time;
// these declarations keep the editor/type tooling happy.
declare module '*.less';
declare module '*?url' {
  const url: string;
  export default url;
}
