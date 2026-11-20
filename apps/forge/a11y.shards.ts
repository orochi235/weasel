/** How many `a11y.<n>.browser.test.tsx` files share the story files, each a tab's worth. */
export const A11Y_SHARDS = 16;

/** The story files shard `shard` judges: every `A11Y_SHARDS`-th in path order, so each shard holds a like mix. */
export const shardOf = (paths: readonly string[], shard: number) => [...paths].sort().filter((_, i) => i % A11Y_SHARDS === shard);
