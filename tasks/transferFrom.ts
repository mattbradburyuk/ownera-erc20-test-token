import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types";
import { formatUnits, getAddress, isAddress, parseUnits } from "viem";

import { defaultDeploymentId, getContractAddress } from "../config/deployedContracts.js";
import { getSigningKey, trackedAccounts } from "../config/trackedAccounts.js";

function resolveAddress(nameOrAddress: string): `0x${string}` {
  const account = trackedAccounts.find(
    (a) => a.name.toLowerCase() === nameOrAddress.toLowerCase(),
  );
  if (account) return account.address;
  if (isAddress(nameOrAddress)) return getAddress(nameOrAddress);
  throw new Error(`"${nameOrAddress}" is not a known account name or valid address`);
}

export default task("transfer-from", "Transfer tokens on behalf of an owner using an allowance")
  .addOption({
    name: "owner",
    description: "Account whose tokens are being spent",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "spender",
    description: "Account with the allowance — must have a private key in .env",
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
  .addOption({
    name: "contract",
    description: "Deployment ID (from ignition/deployments/)",
    defaultValue: defaultDeploymentId,
  })
  .setInlineAction(async ({ owner, spender, to, amount, contract }, hre) => {
    if (!owner) throw new Error("--owner is required");
    if (!spender) throw new Error("--spender is required");
    if (!to) throw new Error("--to is required");
    if (!amount) throw new Error("--amount is required");

    const CONTRACT_ADDRESS = getContractAddress(contract);
    const ownerAddress = resolveAddress(owner);
    const spenderAddress = resolveAddress(spender);
    const toAddress = resolveAddress(to);

    const signingKey = getSigningKey(spenderAddress);
    if (!signingKey) {
      throw new Error(
        `No private key found in .env for "${spender}" (${spenderAddress}). ` +
          `Add the key to sign this transaction.`,
      );
    }

    const { viem } = await hre.network.connect();
    const publicClient = await viem.getPublicClient();
    const spenderWallet = await viem.getWalletClient(spenderAddress);

    const token = await viem.getContractAt("OwneraERC20TestToken", CONTRACT_ADDRESS, {
      client: { wallet: spenderWallet },
    });

    const decimals = await token.read.decimals();
    const amountParsed = parseUnits(amount, decimals);
    const symbol = await token.read.symbol();

    console.log(`Transferring ${amount} ${symbol} via allowance`);
    console.log(`  Owner:    ${owner} (${ownerAddress})`);
    console.log(`  Spender:  ${spender} (${spenderAddress})`);
    console.log(`  To:       ${to} (${toAddress})`);
    console.log(`  Contract: ${CONTRACT_ADDRESS}`);

    const [ownerBalanceBefore, toBalanceBefore, allowanceBefore] = await Promise.all([
      token.read.balanceOf([ownerAddress]),
      token.read.balanceOf([toAddress]),
      token.read.allowance([ownerAddress, spenderAddress]),
    ]);

    const txHash = await token.write.transferFrom([ownerAddress, toAddress, amountParsed]);
    console.log(`  Tx hash:  ${txHash}`);

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    const [ownerBalanceAfter, toBalanceAfter, allowanceAfter] = await Promise.all([
      token.read.balanceOf([ownerAddress]),
      token.read.balanceOf([toAddress]),
      token.read.allowance([ownerAddress, spenderAddress]),
    ]);

    const fmt = (v: bigint) => formatUnits(v, decimals);
    console.log(`\nDone.`);
    console.log(`  ${owner} balance:  ${fmt(ownerBalanceBefore)} → ${fmt(ownerBalanceAfter)} ${symbol}`);
    console.log(`  ${to} balance:     ${fmt(toBalanceBefore)} → ${fmt(toBalanceAfter)} ${symbol}`);
    console.log(`  Allowance remaining: ${fmt(allowanceBefore)} → ${fmt(allowanceAfter)} ${symbol}`);
  })
  .build();
