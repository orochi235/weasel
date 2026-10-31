/** One field: bits `start` to `end`, inclusive. */
export interface PacketField {
  start: number;
  end: number;
  label: string;
  /** Written as a bit count (`+8`) after the field before it, rather than as a range. */
  relative?: boolean;
}

/** A packet diagram: fields laid along rows of bits. */
export interface PacketData {
  kind: 'packet';
  title?: string;
  /** Default 32. */
  bitsPerRow?: number;
  fields: readonly PacketField[];
}
