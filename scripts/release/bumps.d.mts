export interface Bump {
  level: string;
  pkgs: string[];
}
export function readBumps(text: string): { approved: Bump[]; unapproved: Bump[]; leadingMarker: boolean };
export function isChangesetFile(name: string): boolean;
