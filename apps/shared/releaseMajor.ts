/** The major whose releases open the Releases page. Every release before it is listed on a page
 *  of its own, so opening the default page fetches none of that history. */
export const CURRENT_MAJOR = 2;

/** Whether `version` belongs on the older releases page. "Unreleased" never does. */
export function isOlderRelease(version: string): boolean {
  const major = /^(\d+)\./.exec(version);
  return major !== null && Number(major[1]) < CURRENT_MAJOR;
}
