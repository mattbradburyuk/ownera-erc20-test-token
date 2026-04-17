import type { Address } from "viem";
import config from "./trackedAccounts.json";

export interface TrackedAccount {
  name: string;
  address: Address;
}

export const trackedAccounts: TrackedAccount[] = config.accounts as TrackedAccount[];
