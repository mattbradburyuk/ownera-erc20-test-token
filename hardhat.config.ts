import "dotenv/config";

import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

import balanceTask from "./tasks/balance.js";
import changeAdminTask from "./tasks/changeAdmin.js";
import mintTask from "./tasks/mint.js";
import transferTask from "./tasks/transfer.js";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  tasks: [balanceTask, changeAdminTask, mintTask, transferTask],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    hederatestnet: {
      type: "http",
      chainType: "l1",
      url: process.env.HEDERA_TESTNET_RPC_URL!,
      accounts: [
        process.env.HEDERA_TESTNET_DEPLOYER_PRIVATE_KEY!,
        process.env.HEDERA_TESTNET_ADMIN_PRIVATE_KEY!,
        process.env.HEDERA_TESTNET_MINTER_PRIVATE_KEY!,
        process.env.HEDERA_TESTNET_USER1_PRIVATE_KEY!,
      ],
    },
  },
});
