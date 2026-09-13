// fake-indexeddb's `./auto` export declares no `types` condition, so under
// `moduleResolution: Bundler` tsc finds no declaration for it — the ambient one
// the package ships at its root is never part of the compilation. The subpath
// is side-effect-only, so a bare declaration is the whole of it.
declare module 'fake-indexeddb/auto';
