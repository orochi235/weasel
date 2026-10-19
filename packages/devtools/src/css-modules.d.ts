declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// ui's components import plain stylesheets for their side effect, and a
// program that reads ui from source has to accept them.
declare module '*.css';
