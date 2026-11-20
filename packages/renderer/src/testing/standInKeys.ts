/** Names a real context or encoder lacks and callers probe for, which a
 *  recording Proxy must not answer: a `then` makes the stand-in a thenable that
 *  never settles, and a `toJSON` records a call on every stringify. */
export const NOT_METHODS: ReadonlySet<string> = new Set(['then', 'toJSON']);
