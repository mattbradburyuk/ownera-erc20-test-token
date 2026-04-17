import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types";
import { formatUnits, getAddress, isAddress, parseUnits } from "viem";

import { getSigningKey, trackedAccounts } from "../config/trackedAccounts.js";

const CONTRACT_ADDRESS = "0x2723478C8B54238b8D2fa8d30749EC43e37AE540";

function resolveAddress(nameOrAddress: string): `0x${string}` {
  const account = trackedAccounts.find(
    (a) => a.name.toLowerCase() === nameOrAddress.toLowerCase(),
  );
  if (account) return account.address;
  if (isAddress(nameOrAddress)) return getAddress(nameOrAddress);
  throw new Error(`"${nameOrAddress}" is not a known account name or valid address`);
}

export default task("transfer", "Transfer OERC20TT tokens between accounts")
  .addOption({
    name: "from",
    description: "Sender account name (from config/trackedAccounts.json) or address — must have a private key in .env",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "to",
    description: "Recipient account name (from config/trackedAccounts.json) or address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "amount",
    description: "Amount to transfer in whole tokens",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .setInlineAction(async ({ from, to, amount }, hre) => {
    if (!from) throw new Error("--from is required");
    if (!to) throw new Error("--to is required");
    if (!amount) throw new Error("--amount is required");

    const fromAddress = resolveAddress(from);
    const toAddress = resolveAddress(to);

    const signingKey = getSigningKey(fromAddress);
    if (!signingKey) {
      throw new Error(
        `No private key found in .env for "${from}" (${fromAddress}). ` +
          `Add the key to sign this transaction.`,
      );
    }

    const { viem } = await hre.network.connect();
    const publicClient = await viem.getPublicClient();
    const fromWallet = await viem.getWalletClient(fromAddress);

    const token = await viem.getContractAt("OwneraERC20TestToken", CONTRACT_ADDRESS, {
      client: { wallet: fromWallet },
    });

    const decimals = await token.read.decimals();
    const amountParsed = parseUnits(amount, decimals);
    const symbol = await token.read.symbol();

    console.log(`Transferring ${amount} ${symbol}`);
    console.log(`  From: ${from} (${fromAddress})`);
    console.log(`  To:   ${to} (${toAddress})`);
    console.log(`  Contract: ${CONTRACT_ADDRESS}`);

    const [balanceFromBefore, balanceToBefore] = await Promise.all([
      token.read.balanceOf([fromAddress]),
      token.read.balanceOf([toAddress]),
    ]);

    const txHash = await token.write.transfer([toAddress, amountParsed]);
    console.log(`  Tx hash:  ${txHash}`);

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    const [balanceFromAfter, balanceToAfter] = await Promise.all([
      token.read.balanceOf([fromAddress]),
      token.read.balanceOf([toAddress]),
    ]);

    const fmt = (v: bigint) => formatUnits(v, decimals);
    console.log(`\nDone.`);
    console.log(`  ${from} balance: ${fmt(balanceFromBefore)} → ${fmt(balanceFromAfter)}`);
    console.log(`  ${to} balance:   ${fmt(balanceToBefore)} → ${fmt(balanceToAfter)}`);
  })
  .build();
