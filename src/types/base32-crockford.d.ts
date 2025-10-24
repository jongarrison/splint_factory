declare module 'base32-crockford' {
  export function encode(value: number | Buffer): string;
  export function decode(encoded: string): number;
}
