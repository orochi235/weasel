/** A snapshot that is not shaped as `toJSON()` writes one: what is wrong, and where. */
export class SnapshotShapeError extends Error {
  override name = 'SnapshotShapeError';
}
