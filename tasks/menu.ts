import { spawnSync } from "node:child_process";

import { task } from "hardhat/config";
import { input, select } from "@inquirer/prompts";

import { getSigningKey, trackedAccounts } from "../config/trackedAccounts.js";

function allAccountChoices() {
  return trackedAccounts.map((a) => ({
    name: `${a.name}  (${a.address})`,
    value: a.name,
  }));
}

function signingAccountChoices() {
  return trackedAccounts
    .filter((a) => !!getSigningKey(a.address))
    .map((a) => ({
      name: `${a.name}  (${a.address})`,
      value: a.name,
    }));
}

const TASK_CHOICES = [
  { value: "balance",            name: "balance            – print balances & roles" },
  { value: "allowances",         name: "allowances         – list allowances for an account" },
  { value: "mint",               name: "mint               – mint tokens to an account" },
  { value: "transfer",           name: "transfer           – transfer tokens between accounts" },
  { value: "transfer-from",      name: "transfer-from      – transfer tokens via an allowance" },
  { value: "approve-allowance",  name: "approve-allowance  – approve a spender allowance" },
  { value: "revoke-allowance",   name: "revoke-allowance   – revoke a spender allowance" },
  { value: "change-admin",       name: "change-admin       – transfer DEFAULT_ADMIN_ROLE" },
];

export default task("menu", "Interactive menu for running tasks")
  .setInlineAction(async (_args, _hre) => {
    const taskName = await select({
      message: "Select a task",
      choices: TASK_CHOICES,
      pageSize: TASK_CHOICES.length,
    });

    let args: Record<string, string> = {};

    switch (taskName) {
      case "balance":
        break;

      case "allowances": {
        const choices = allAccountChoices();
        const owner = await select({ message: "Owner", choices, pageSize: choices.length });
        args = { owner };
        break;
      }

      case "mint": {
        const choices = allAccountChoices();
        const recipient = await select({ message: "Recipient", choices, pageSize: choices.length });
        const amount = await input({ message: "Amount (whole tokens)" });
        args = { recipient, amount };
        break;
      }

      case "transfer": {
        const signingChoices = signingAccountChoices();
        const allChoices = allAccountChoices();
        const from = await select({ message: "From (sender)", choices: signingChoices, pageSize: signingChoices.length });
        const to = await select({ message: "To (recipient)", choices: allChoices, pageSize: allChoices.length });
        const amount = await input({ message: "Amount (whole tokens)" });
        args = { from, to, amount };
        break;
      }

      case "transfer-from": {
        const allChoices = allAccountChoices();
        const signingChoices = signingAccountChoices();
        const owner = await select({ message: "Owner (whose tokens are spent)", choices: allChoices, pageSize: allChoices.length });
        const spender = await select({ message: "Spender (has allowance, signs)", choices: signingChoices, pageSize: signingChoices.length });
        const toChoices = allAccountChoices();
        const to = await select({ message: "To (recipient)", choices: toChoices, pageSize: toChoices.length });
        const amount = await input({ message: "Amount (whole tokens)" });
        args = { owner, spender, to, amount };
        break;
      }

      case "approve-allowance": {
        const signingChoices = signingAccountChoices();
        const allChoices = allAccountChoices();
        const owner = await select({ message: "Owner (approves, signs)", choices: signingChoices, pageSize: signingChoices.length });
        const spender = await select({ message: "Spender", choices: allChoices, pageSize: allChoices.length });
        const amount = await input({ message: "Amount (whole tokens)" });
        args = { owner, spender, amount };
        break;
      }

      case "revoke-allowance": {
        const signingChoices = signingAccountChoices();
        const allChoices = allAccountChoices();
        const owner = await select({ message: "Owner (signs)", choices: signingChoices, pageSize: signingChoices.length });
        const spender = await select({ message: "Spender", choices: allChoices, pageSize: allChoices.length });
        args = { owner, spender };
        break;
      }

      case "change-admin": {
        const choices = allAccountChoices();
        const newAdmin = await select({
          message: "New admin",
          choices,
          pageSize: choices.length,
          default: choices.find((c) => c.value === "Admin")?.value,
        });
        args = { newAdmin };
        break;
      }
    }

    const networkFlagIdx = process.argv.indexOf("--network");
    const network = networkFlagIdx !== -1 ? process.argv[networkFlagIdx + 1] : undefined;

    const cmdParts = ["hardhat", taskName];
    if (network) cmdParts.push("--network", network);
    for (const [key, val] of Object.entries(args)) {
      cmdParts.push(`--${key}`, val);
    }

    const result = spawnSync("npx", cmdParts, { stdio: "inherit", cwd: process.cwd() });
    if (result.error) throw result.error;
  })
  .build();
