import { task } from "hardhat/config";
import { formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { trackedAccounts } from "../config/trackedAccounts.js";

const CONTRACT_ADDRESS = "0x2723478C8B54238b8D2fa8d30749EC43e37AE540";

async function fetchHederaAccountId(mirrorNodeBase: string, address: string): Promise<string> {
  try {
    const res = await fetch(`${mirrorNodeBase}/api/v1/accounts/${address}`);
    if (!res.ok) return "-";
    const data = await res.json() as { account?: string };
    return data.account ?? "-";
  } catch {
    return "-";
  }
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

export default task("balance", "Print token balances, roles, and allowances for tracked accounts")
  .setInlineAction(async (_args, hre) => {
    const ownedAddresses = new Set(
      [
        process.env.HEDERA_TESTNET_DEPLOYER_PRIVATE_KEY,
        process.env.HEDERA_TESTNET_ADMIN_PRIVATE_KEY,
        process.env.HEDERA_TESTNET_MINTER_PRIVATE_KEY,
        process.env.HEDERA_TESTNET_USER1_PRIVATE_KEY,
      ]
        .filter(Boolean)
        .map((key) => privateKeyToAccount(key as `0x${string}`).address.toLowerCase()),
    );

    const networkConnection = await hre.network.connect();
    const { viem } = networkConnection;

    const mirrorNodeBase = networkConnection.networkName.includes("hedera")
      ? networkConnection.networkName.includes("mainnet")
        ? "https://mainnet-public.mirrornode.hedera.com"
        : "https://testnet.mirrornode.hedera.com"
      : null;
    const token = await viem.getContractAt("OwneraERC20TestToken", CONTRACT_ADDRESS);

    const [symbol, decimals, MINTER_ROLE, DEFAULT_ADMIN_ROLE, totalSupply] = await Promise.all([
      token.read.symbol(),
      token.read.decimals(),
      token.read.MINTER_ROLE(),
      token.read.DEFAULT_ADMIN_ROLE(),
      token.read.totalSupply(),
    ]);

    const accountRows = await Promise.all(
      trackedAccounts.map(async ({ name, address }) => {
        const [balance, isAdmin, isMinter, hederaId] = await Promise.all([
          token.read.balanceOf([address]),
          token.read.hasRole([DEFAULT_ADMIN_ROLE, address]),
          token.read.hasRole([MINTER_ROLE, address]),
          mirrorNodeBase ? fetchHederaAccountId(mirrorNodeBase, address) : Promise.resolve(null),
        ]);
        const hasKey = ownedAddresses.has(address.toLowerCase());
        return { name, address, balance, isAdmin, isMinter, hasKey, hederaId };
      }),
    );

    const check = (v: boolean) => (v ? "✓" : "-");
    const fmt = (v: bigint) => formatUnits(v, decimals);

    console.log(`\n── Token: ${symbol} ──────────────────────────────────────────────`);
    console.log(`   Contract: ${CONTRACT_ADDRESS}\n`);

    const showHederaId = mirrorNodeBase !== null;
    table(
      showHederaId
        ? ["Account", "Hedera ID", "EVM Address", `Balance (${symbol})`, "Admin", "Minter", "Key"]
        : ["Account", "EVM Address", `Balance (${symbol})`, "Admin", "Minter", "Key"],
      accountRows.map(({ name, address, balance, isAdmin, isMinter, hasKey, hederaId }) =>
        showHederaId
          ? [name, hederaId ?? "-", address, fmt(balance), check(isAdmin), check(isMinter), check(hasKey)]
          : [name, address, fmt(balance), check(isAdmin), check(isMinter), check(hasKey)],
      ),
      showHederaId ? [3] : [2],
    );

    console.log(`\n  Total supply: ${fmt(totalSupply)} ${symbol}\n`);
  })
  .build();
