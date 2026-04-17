import "dotenv/config";

import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

import { trackedAccounts } from "./config/trackedAccounts.js";

import allowancesTask from "./tasks/allowances.js";
import approveAllowanceTask from "./tasks/approveAllowance.js";
import balanceTask from "./tasks/balance.js";
import changeAdminTask from "./tasks/changeAdmin.js";
import menuTask from "./tasks/menu.js";
import mintTask from "./tasks/mint.js";
import revokeAllowanceTask from "./tasks/revokeAllowance.js";
import transferTask from "./tasks/transfer.js";
import transferFromTask from "./tasks/transferFrom.js";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  tasks: [allowancesTask, approveAllowanceTask, balanceTask, changeAdminTask, menuTask, mintTask, revokeAllowanceTask, transferTask, transferFromTask],
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
      accounts: trackedAccounts
        .filter((a) => a.envKey && process.env[a.envKey])
        .map((a) => process.env[a.envKey!] as string),
    },
  },
});
