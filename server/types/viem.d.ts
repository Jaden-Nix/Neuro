declare module 'viem' {
  export function createPublicClient(config: any): any;
  export function createWalletClient(config: any): any;
  export function http(url?: string): any;
  export function encodeFunctionData(config: any): string;
  export function keccak256(data: `0x${string}`): `0x${string}`;
  export function toHex(value: string | number | bigint | boolean): `0x${string}`;
  export type Address = `0x${string}`;
  export type Hash = `0x${string}`;
}

declare module 'viem/accounts' {
  export function privateKeyToAccount(privateKey: `0x${string}`): any;
}

declare module 'viem/chains' {
  export const baseSepolia: any;
  export const base: any;
  export const mainnet: any;
  export const sepolia: any;
}
