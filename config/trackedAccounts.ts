import type { Address } from "viem";

export const trackedAccounts: Array<{ name: string; address: Address }> = [
  { name: "Deployer", address: "0x1de5f1d073f93458397048231d76ab590675fa96" },
  { name: "Admin",    address: "0xe289a429ea344768d91a08b34b2278fade5e6240" },
  { name: "Minter",   address: "0x72A8C3ead0a9C5009e14Ba7Ab8fDE1ebe9334420" },
  { name: "User1",    address: "0x0000000000000000000000000000000000000000" },
  { name: "Holder1",  address: "0x0000000000000000000000000000000000789efd" },
];

// ERC20 allowance pairs to track — add entries as accounts approve each other.
// Names must match entries in trackedAccounts above.
export const trackedAllowances: Array<{ owner: string; spender: string }> = [
  // { owner: "Holder1", spender: "Minter" },
];
