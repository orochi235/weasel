export const BODY_LIMIT: number;
export function changelogSection(changelog: string, version: string): string | null;
export function releaseBody(
  section: string,
  options: { changelogUrl: string; limit?: number },
): string;
