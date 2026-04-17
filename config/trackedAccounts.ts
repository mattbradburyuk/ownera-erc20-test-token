import type { Address } from "viem";
import config from "./trackedAccounts.json";

export interface TrackedAccount {
  name: string;
  address: Address;
}

export interface TrackedAllowance {
  owner: string;
  spender: string;
}

export const trackedAccounts: TrackedAccount[] = config.accounts as TrackedAccount[];
export const trackedAllowances: TrackedAllowance[] = config.allowances as TrackedAllowance[];
