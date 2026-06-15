/**
 * A JSON-serializable value.
 *
 * Templates are plain serializable data: anything expressible in the
 * template types is expressible in JSON, so values that must survive
 * serialization are constrained to this type.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
