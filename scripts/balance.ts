import { network } from "hardhat";
import { formatUnits } from "viem";

import { trackedAccounts, trackedAllowances } from "../config/trackedAccounts.js";

// ─── Configuration ────────────────────────────────────────────────────────────
const CONTRACT_ADDRESS = "0x2723478C8B54238b8D2fa8d30749EC43e37AE540";
// ─────────────────────────────────────────────────────────────────────────────

const { viem } = await network.connect();
const token = await viem.getContractAt("OwneraERC20TestToken", CONTRACT_ADDRESS);

const [symbol, decimals, MINTER_ROLE, DEFAULT_ADMIN_ROLE, totalSupply] = await Promise.all([
  token.read.symbol(),
  token.read.decimals(),
  token.read.MINTER_ROLE(),
  token.read.DEFAULT_ADMIN_ROLE(),
  token.read.totalSupply(),
]);

// ─── Accounts ─────────────────────────────────────────────────────────────────

const accountRows = await Promise.all(
  trackedAccounts.map(async ({ name, address }) => {
    const [balance, isAdmin, isMinter] = await Promise.all([
      token.read.balanceOf([address]),
      token.read.hasRole([DEFAULT_ADMIN_ROLE, address]),
      token.read.hasRole([MINTER_ROLE, address]),
    ]);
    return { name, address, balance, isAdmin, isMinter };
  }),
);

// ─── Allowances ───────────────────────────────────────────────────────────────

const accountByName = Object.fromEntries(trackedAccounts.map((a) => [a.name, a.address]));

const allowanceRows = await Promise.all(
  trackedAllowances.map(async ({ owner, spender }) => {
    const ownerAddress   = accountByName[owner];
    const spenderAddress = accountByName[spender];
    if (!ownerAddress)   throw new Error(`Unknown account "${owner}" in trackedAllowances`);
    if (!spenderAddress) throw new Error(`Unknown account "${spender}" in trackedAllowances`);
    const allowance = await token.read.allowance([ownerAddress, spenderAddress]);
    return { owner, spender, allowance };
  }),
);

// ─── Table rendering ──────────────────────────────────────────────────────────

function table(headers: string[], rows: string[][], rightAlign: number[] = []) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const divider = `+-${widths.map((w) => "-".repeat(w)).join("-+-")}-+`;
  const fmt = (cells: string[]) =>
    `| ${cells.map((c, i) => rightAlign.includes(i) ? c.padStart(widths[i]) : c.padEnd(widths[i])).join(" | ")} |`;

  console.log(divider);
  console.log(fmt(headers));
  console.log(divider);
  for (const row of rows) console.log(fmt(row));
  console.log(divider);
}

const check = (v: boolean) => (v ? "✓" : "-");
const fmt   = (v: bigint)   => formatUnits(v, decimals);

console.log(`\n── Token: ${symbol} ──────────────────────────────────────────────\n`);

table(
  ["Account", "Address", `Balance (${symbol})`, "Admin", "Minter"],
  accountRows.map(({ name, address, balance, isAdmin, isMinter }) => [
    name, address, fmt(balance), check(isAdmin), check(isMinter),
  ]),
  [2],
);

console.log(`\n  Total supply: ${fmt(totalSupply)} ${symbol}\n`);

if (allowanceRows.length > 0) {
  console.log(`── Allowances (${symbol}) ────────────────────────────────────────\n`);
  table(
    ["Owner", "Spender", `Allowance (${symbol})`],
    allowanceRows.map(({ owner, spender, allowance }) => [owner, spender, fmt(allowance)]),
    [2],
  );
  console.log();
}
