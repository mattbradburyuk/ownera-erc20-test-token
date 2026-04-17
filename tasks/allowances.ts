import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types";
import { formatUnits, getAddress, isAddress } from "viem";

import { trackedAccounts } from "../config/trackedAccounts.js";

const CONTRACT_ADDRESS = "0x2723478C8B54238b8D2fa8d30749EC43e37AE540";

function resolveAddress(nameOrAddress: string): `0x${string}` {
  const account = trackedAccounts.find(
    (a) => a.name.toLowerCase() === nameOrAddress.toLowerCase(),
  );
  if (account) return account.address;
  if (isAddress(nameOrAddress)) return getAddress(nameOrAddress);
  throw new Error(`"${nameOrAddress}" is not a known account name or valid address`);
}

function table(headers: string[], rows: string[][], rightAlign: number[] = []) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const divider = `+-${widths.map((w) => "-".repeat(w)).join("-+-")}-+`;
  const fmt = (cells: string[]) =>
    `| ${cells.map((c, i) => (rightAlign.includes(i) ? c.padStart(widths[i]) : c.padEnd(widths[i]))).join(" | ")} |`;

  console.log(divider);
  console.log(fmt(headers));
  console.log(divider);
  for (const row of rows) console.log(fmt(row));
  console.log(divider);
}

export default task("allowances", "List allowances granted by an account to all tracked accounts")
  .addOption({
    name: "owner",
    description: "Owner account name (from config/trackedAccounts.json) or address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .setInlineAction(async ({ owner }, hre) => {
    if (!owner) throw new Error("--owner is required");

    const ownerAddress = resolveAddress(owner);

    const { viem } = await hre.network.connect();
    const token = await viem.getContractAt("OwneraERC20TestToken", CONTRACT_ADDRESS);

    const [decimals, symbol] = await Promise.all([
      token.read.decimals(),
      token.read.symbol(),
    ]);

    const spenders = trackedAccounts.filter(
      (a) => a.address.toLowerCase() !== ownerAddress.toLowerCase(),
    );

    const rows = await Promise.all(
      spenders.map(async ({ name, address }) => {
        const allowance = await token.read.allowance([ownerAddress, address]);
        return [name, address, formatUnits(allowance, decimals)];
      }),
    );

    console.log(`\n── Allowances granted by ${owner} (${ownerAddress})`);
    console.log(`   Token: ${symbol} | Contract: ${CONTRACT_ADDRESS}\n`);
    table(["Spender", "Address", `Allowance (${symbol})`], rows, [2]);
    console.log();
  })
  .build();
