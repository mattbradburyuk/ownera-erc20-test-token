import { task } from "hardhat/config";
import { privateKeyToAccount } from "viem/accounts";

import { defaultDeploymentId, getContractAddress } from "../config/deployedContracts.js";
import { trackedAccounts } from "../config/trackedAccounts.js";

export default task("change-admin", "Transfer DEFAULT_ADMIN_ROLE to another account")
  .addOption({
    name: "newAdmin",
    description:
      "Name of the account to transfer DEFAULT_ADMIN_ROLE to (must be in config/trackedAccounts.json)",
    defaultValue: "Admin",
  })
  .addOption({
    name: "contract",
    description: "Deployment ID (from ignition/deployments/)",
    defaultValue: defaultDeploymentId,
  })
  .setInlineAction(async ({ newAdmin: newAdminName, contract }, hre) => {
    const CONTRACT_ADDRESS = getContractAddress(contract);
    const knownKeys = [
      process.env.HEDERA_TESTNET_DEPLOYER_PRIVATE_KEY,
      process.env.HEDERA_TESTNET_ADMIN_PRIVATE_KEY,
      process.env.HEDERA_TESTNET_MINTER_PRIVATE_KEY,
      process.env.HEDERA_TESTNET_USER1_PRIVATE_KEY,
    ]
      .filter(Boolean)
      .map((key) => {
        const account = privateKeyToAccount(key as `0x${string}`);
        return { address: account.address, key: key as `0x${string}` };
      });

    const keyByAddress = Object.fromEntries(
      knownKeys.map(({ address, key }) => [address.toLowerCase(), key]),
    );

    const newAdmin = trackedAccounts.find((a) => a.name === newAdminName);
    if (!newAdmin) throw new Error(`"${newAdminName}" not found in config/trackedAccounts.json`);

    const { viem } = await hre.network.connect();
    const publicClient = await viem.getPublicClient();
    const token = await viem.getContractAt("OwneraERC20TestToken", CONTRACT_ADDRESS);
    const DEFAULT_ADMIN_ROLE = await token.read.DEFAULT_ADMIN_ROLE();

    const roleChecks = await Promise.all(
      trackedAccounts.map((account) =>
        token.read
          .hasRole([DEFAULT_ADMIN_ROLE, account.address])
          .then((has) => ({ ...account, has })),
      ),
    );
    const currentAdmin = roleChecks.find((a) => a.has);

    if (!currentAdmin) {
      throw new Error(
        "No account in config/trackedAccounts.json currently holds DEFAULT_ADMIN_ROLE. " +
          "Add the current admin to the config file.",
      );
    }

    if (currentAdmin.address.toLowerCase() === newAdmin.address.toLowerCase()) {
      console.log(`${newAdminName} already holds DEFAULT_ADMIN_ROLE. Nothing to do.`);
      return;
    }

    const signingKey = keyByAddress[currentAdmin.address.toLowerCase()];
    if (!signingKey) {
      throw new Error(
        `Found that "${currentAdmin.name}" (${currentAdmin.address}) holds DEFAULT_ADMIN_ROLE, ` +
          `but no matching private key was found in .env. Add the key to sign this transaction.`,
      );
    }

    console.log(`Transferring DEFAULT_ADMIN_ROLE`);
    console.log(`  From: ${currentAdmin.name} (${currentAdmin.address})`);
    console.log(`  To:   ${newAdmin.name} (${newAdmin.address})`);

    const adminWallet = await viem.getWalletClient(currentAdmin.address);
    const tokenAsAdmin = await viem.getContractAt("OwneraERC20TestToken", CONTRACT_ADDRESS, {
      client: { wallet: adminWallet },
    });

    console.log(`\nGranting role to ${newAdmin.name}...`);
    const grantTx = await tokenAsAdmin.write.grantRole([DEFAULT_ADMIN_ROLE, newAdmin.address]);
    await publicClient.waitForTransactionReceipt({ hash: grantTx });
    console.log(`  Tx: ${grantTx}`);

    console.log(`Revoking role from ${currentAdmin.name}...`);
    const revokeTx = await tokenAsAdmin.write.revokeRole([DEFAULT_ADMIN_ROLE, currentAdmin.address]);
    await publicClient.waitForTransactionReceipt({ hash: revokeTx });
    console.log(`  Tx: ${revokeTx}`);

    console.log(`\nDone. Run \`npx hardhat balance\` to verify.`);
  })
  .build();
