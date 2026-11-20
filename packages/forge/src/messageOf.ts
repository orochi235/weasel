/** What `err` says: its message when it is an `Error`, itself as text when it is anything else. */
export const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));
