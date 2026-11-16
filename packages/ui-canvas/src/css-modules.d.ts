declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// Plain (non-module) stylesheets, imported for their side effect only —
// e.g. Toast's view-transition keyframes. Without this, `tsc` refuses the
// side-effect import outright (TS2882) during the declaration build.
declare module '*.css';
