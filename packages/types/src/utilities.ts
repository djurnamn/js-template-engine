/**
 * Utility type that makes all properties of T optional recursively.
 * Useful for creating partial versions of complex types.
 * @template T - The type to make deeply partial.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
