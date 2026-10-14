/**
 * TypeDoc's `ReflectionKind` values, as its JSON carries them. Restated here
 * because the enum itself is a runtime import of the whole of TypeDoc, and the
 * reader runs wherever the site is built.
 */
export const Kind = {
  Module: 2,
  Namespace: 4,
  Enum: 8,
  EnumMember: 16,
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  Constructor: 512,
  Property: 1024,
  Method: 2048,
  Accessor: 262144,
  TypeAlias: 2097152,
} as const;
