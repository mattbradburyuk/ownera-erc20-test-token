import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types";
import { formatUnits, getAddress, isAddress, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

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

export default task("approve-allowance", "Approve a spender allowance on behalf of an owner")
  .addOption({
    name: "owner",
    description: "Owner account name (from config/trackedAccounts.json) or address — must have a private key in .env",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "spender",
    description: "Spender account name (from config/trackedAccounts.json) or address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "amount",
    description: "Allowance amount in whole tokens",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .setInlineAction(async ({ owner, spender, amount }, hre) => {
    if (!owner) throw new Error("--owner is required");
    if (!spender) throw new Error("--spender is required");
    if (!amount) throw new Error("--amount is required");

    const ownerAddress = resolveAddress(owner);
    const spenderAddress = resolveAddress(spender);

    const knownKeys = [
      process.env.HEDERA_TESTNET_DEPLOYER_PRIVATE_KEY,
      process.env.HEDERA_TESTNET_ADMIN_PRIVATE_KEY,
      process.env.HEDERA_TESTNET_MINTER_PRIVATE_KEY,
      process.env.HEDERA_TESTNET_USER1_PRIVATE_KEY,
    ]
      .filter(Boolean)
      .map((key) => {
        const account = privateKeyToAccount(key as `0x${string}`);
        return { address: account.address.toLowerCase(), key: key as `0x${string}` };
      });

    const signingKey = knownKeys.find((k) => k.address === ownerAddress.toLowerCase())?.key;
    if (!signingKey) {
      throw new Error(
        `No private key found in .env for "${owner}" (${ownerAddress}). ` +
          `Add the key to sign this transaction.`,
      );
    }

    const { viem } = await hre.network.connect();
    const publicClient = await viem.getPublicClient();
    const ownerWallet = await viem.getWalletClient(ownerAddress);

    const token = await viem.getContractAt("OwneraERC20TestToken", CONTRACT_ADDRESS, {
      client: { wallet: ownerWallet },
    });

    const decimals = await token.read.decimals();
    const amountParsed = parseUnits(amount, decimals);
    const symbol = await token.read.symbol();

    console.log(`Approving allowance of ${amount} ${symbol}`);
    console.log(`  Owner:    ${owner} (${ownerAddress})`);
    console.log(`  Spender:  ${spender} (${spenderAddress})`);
    console.log(`  Contract: ${CONTRACT_ADDRESS}`);

    const allowanceBefore = await token.read.allowance([ownerAddress, spenderAddress]);

    const txHash = await token.write.approve([spenderAddress, amountParsed]);
    console.log(`  Tx hash:  ${txHash}`);

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    const allowanceAfter = await token.read.allowance([ownerAddress, spenderAddress]);

    const fmt = (v: bigint) => formatUnits(v, decimals);
    console.log(`\nDone.`);
    console.log(`  Allowance before: ${fmt(allowanceBefore)} ${symbol}`);
    console.log(`  Allowance after:  ${fmt(allowanceAfter)} ${symbol}`);
  })
  .build();
