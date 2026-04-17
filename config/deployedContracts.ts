import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Address } from "viem";

export interface DeployedContract {
  id: string;
  contractKey: string; // "ModuleName#ContractName"
  address: Address;
}

function scanDeployments(): DeployedContract[] {
  const deploymentsDir = join(process.cwd(), "ignition", "deployments");
  if (!existsSync(deploymentsDir)) return [];
  return readdirSync(deploymentsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const addressesPath = join(deploymentsDir, d.name, "deployed_addresses.json");
      if (!existsSync(addressesPath)) return [];
      const addresses = JSON.parse(readFileSync(addressesPath, "utf-8")) as Record<string, string>;
      const entries = Object.entries(addresses);
      if (entries.length === 0) return [];
      const [contractKey, address] = entries[0];
      return [{ id: d.name, contractKey, address: address as Address }];
    });
}

export const deployedContracts: DeployedContract[] = scanDeployments();

export const defaultDeploymentId: string = deployedContracts[0]?.id ?? "";

export function getContractAddress(deploymentId: string): Address {
  const entry = deployedContracts.find((c) => c.id === deploymentId);
  if (!entry) throw new Error(`Deployment "${deploymentId}" not found in ignition/deployments/`);
  return entry.address;
}
