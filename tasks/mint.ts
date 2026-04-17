import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types";
import { formatUnits, getAddress, isAddress, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { defaultDeploymentId, getContractAddress } from "../config/deployedContracts.js";
import { trackedAccounts } from "../config/trackedAccounts.js";

function resolveAddress(nameOrAddress: string): `0x${string}` {
  const account = trackedAccounts.find(
    (a) => a.name.toLowerCase() === nameOrAddress.toLowerCase(),
  );
  if (account) return account.address;
  if (isAddress(nameOrAddress)) return getAddress(nameOrAddress);
  throw new Error(`"${nameOrAddress}" is not a known account name or valid address`);
}

export default task("mint", "Mint OERC20TT tokens to an account")
  .addOption({
    name: "recipient",
    description: "Account name (from config/trackedAccounts.json) or raw address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "amount",
    description: "Amount to mint in whole tokens",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "contract",
    description: "Deployment ID (from ignition/deployments/)",
    defaultValue: defaultDeploymentId,
  })
  .setInlineAction(async ({ recipient, amount, contract }, hre) => {
    if (!recipient) throw new Error("--recipient is required");
    if (!amount) throw new Error("--amount is required");

    const CONTRACT_ADDRESS = getContractAddress(contract);
    const recipientAddress = resolveAddress(recipient);

    const minterPrivateKey = process.env.HEDERA_TESTNET_MINTER_PRIVATE_KEY as `0x${string}`;
    if (!minterPrivateKey) throw new Error("HEDERA_TESTNET_MINTER_PRIVATE_KEY is not set");

    const minterAccount = privateKeyToAccount(minterPrivateKey);

    const { viem } = await hre.network.connect();
    const publicClient = await viem.getPublicClient();
    const minterWallet = await viem.getWalletClient(minterAccount.address);

    const token = await viem.getContractAt("OwneraERC20TestToken", CONTRACT_ADDRESS, {
      client: { wallet: minterWallet },
    });

    const decimals = await token.read.decimals();
    const amountParsed = parseUnits(amount, decimals);
    const symbol = await token.read.symbol();

    console.log(`Minting ${amount} ${symbol} to ${recipient} (${recipientAddress})...`);
    console.log(`  Minter:   ${minterWallet.account.address}`);
    console.log(`  Contract: ${CONTRACT_ADDRESS}`);

    const balanceBefore = await token.read.balanceOf([recipientAddress]);

    const txHash = await token.write.mint([recipientAddress, amountParsed]);
    console.log(`  Tx hash:  ${txHash}`);

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    const balanceAfter = await token.read.balanceOf([recipientAddress]);

    console.log(`Done.`);
    console.log(`  Balance before: ${formatUnits(balanceBefore, decimals)}`);
    console.log(`  Balance after:  ${formatUnits(balanceAfter, decimals)}`);
  })
  .build();
