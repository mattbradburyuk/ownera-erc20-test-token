import type { Address } from "viem";
import config from "./trackedAccounts.json";

export interface TrackedAccount {
  name: string;
  address: Address;
  envKey?: string;
}

export const trackedAccounts: TrackedAccount[] = config.accounts as TrackedAccount[];

export function getSigningKey(address: Address): `0x${string}` | undefined {
  const account = trackedAccounts.find(
    (a) => a.address.toLowerCase() === address.toLowerCase(),
  );
  if (!account?.envKey) return undefined;
  const key = process.env[account.envKey];
  return key ? (key as `0x${string}`) : undefined;
}
