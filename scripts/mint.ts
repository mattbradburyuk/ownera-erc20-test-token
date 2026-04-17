import { network } from "hardhat";
import { formatUnits, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ─── Configuration ────────────────────────────────────────────────────────────
// Address of the deployed contract (from ignition/deployments/.../deployed_addresses.json)
const CONTRACT_ADDRESS = "0x2723478C8B54238b8D2fa8d30749EC43e37AE540";

// Recipient of the minted tokens
const RECIPIENT = "0x0000000000000000000000000000000000789efd";

// Amount to mint — expressed in whole tokens (decimals are handled below)
const AMOUNT = "1000";
// ─────────────────────────────────────────────────────────────────────────────

// dotenv is loaded via hardhat.config.ts, so process.env is populated here.
// We derive the minter account directly from its private key so the script is
// explicit about which signer is used regardless of account ordering.
const minterPrivateKey = process.env.HEDERA_TESTNET_MINTER_PRIVATE_KEY as `0x${string}`;
if (!minterPrivateKey) throw new Error("HEDERA_TESTNET_MINTER_PRIVATE_KEY is not set");

const minterAccount = privateKeyToAccount(minterPrivateKey);

const { viem } = await network.connect();
const publicClient = await viem.getPublicClient();
const minterWallet = await viem.getWalletClient(minterAccount.address);

const token = await viem.getContractAt("OwneraERC20TestToken", CONTRACT_ADDRESS, {
  client: { wallet: minterWallet },
});

const decimals = await token.read.decimals();
const amount = parseUnits(AMOUNT, decimals);

console.log(`Minting ${AMOUNT} ${await token.read.symbol()} to ${RECIPIENT}...`);
console.log(`  Minter:   ${minterWallet.account.address}`);
console.log(`  Contract: ${CONTRACT_ADDRESS}`);

const balanceBefore = await token.read.balanceOf([RECIPIENT]);

const txHash = await token.write.mint([RECIPIENT, amount]);
console.log(`  Tx hash:  ${txHash}`);

await publicClient.waitForTransactionReceipt({ hash: txHash });

const balanceAfter = await token.read.balanceOf([RECIPIENT]);

console.log(`Done.`);
console.log(`  Balance before: ${formatUnits(balanceBefore, decimals)}`);
console.log(`  Balance after:  ${formatUnits(balanceAfter, decimals)}`);
