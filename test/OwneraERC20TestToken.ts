import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress, zeroAddress } from "viem";

import { network } from "hardhat";

describe("OwneraERC20TestToken", async function () {
  const { viem } = await network.connect();

  // ─── Helpers ────────────────────────────────────────────────────────────────

  async function deployToken() {
    // getWalletClients() returns the funded test accounts provided by the
    // network (Hardhat's default accounts in both in-process and npx hardhat node).
    // Each wallet is a signer; we use separate ones so tests can act as different
    // roles without cross-contamination.
    const [adminWallet, minterWallet, otherWallet, anotherWallet] =
      await viem.getWalletClients();

    const token = await viem.deployContract("OwneraERC20TestToken", [
      adminWallet.account.address,
      minterWallet.account.address,
    ]);

    // Read role hashes from the contract rather than recomputing them locally,
    // so the test values are always in sync with what the contract actually uses.
    const MINTER_ROLE = await token.read.MINTER_ROLE();
    const DEFAULT_ADMIN_ROLE = await token.read.DEFAULT_ADMIN_ROLE();

    // publicClient is a read-only client used for eth_call (simulateContract).
    // It is not tied to a signer — see assertRevertWithCustomError below.
    const publicClient = await viem.getPublicClient();

    // getContractAt returns a contract instance bound to a specific wallet.
    // contract.write.* calls are sent from that wallet's address, which is how
    // we test role-gated functions as different callers without redeploying.
    const tokenAsAdmin = await viem.getContractAt(
      "OwneraERC20TestToken",
      token.address,
      { client: { wallet: adminWallet } },
    );
    const tokenAsMinter = await viem.getContractAt(
      "OwneraERC20TestToken",
      token.address,
      { client: { wallet: minterWallet } },
    );
    const tokenAsOther = await viem.getContractAt(
      "OwneraERC20TestToken",
      token.address,
      { client: { wallet: otherWallet } },
    );

    return {
      token,
      tokenAsAdmin,
      tokenAsMinter,
      tokenAsOther,
      adminWallet,
      minterWallet,
      otherWallet,
      anotherWallet,
      MINTER_ROLE,
      DEFAULT_ADMIN_ROLE,
      publicClient,
    };
  }

  // assertRevertWithCustomError uses simulateContract (eth_call) rather than
  // contract.write.* (eth_sendRawTransaction) for revert assertions.
  //
  // Why the distinction matters:
  //   - contract.write.* submits a real transaction. On an external HTTP node
  //     (e.g. `npx hardhat node --network localhost`) the JSON-RPC error for a
  //     reverted transaction is a generic "Internal error" that does not carry
  //     the raw revert bytes, so the assertion library cannot decode the custom
  //     error from it.
  //   - simulateContract calls eth_call, which executes the transaction without
  //     mining it. The node returns the revert data directly in the JSON-RPC
  //     response on *both* in-process and HTTP networks. Viem decodes this into
  //     a structured error with `data.errorName` and `data.args`, which we can
  //     inspect reliably regardless of which network the tests run against.
  //
  // Tests that expect success still use contract.write.* because they need the
  // transaction to actually be mined (state must change for the assertions to
  // mean anything).
  async function assertRevertWithCustomError(
    simulate: Promise<unknown>,
    errorName: string,
    args: unknown[],
  ) {
    await assert.rejects(simulate, (err: unknown) => {
      // Viem wraps errors in a cause chain. Walk it until we find the decoded
      // custom error data (errorName + args), which viem sets on the inner
      // ContractFunctionRevertedError.
      let current: any = err;
      while (current !== undefined) {
        if (typeof current?.data?.errorName === "string") {
          assert.equal(current.data.errorName, errorName);
          assert.deepEqual(current.data.args, args);
          return true;
        }
        current = current.cause;
      }
      throw new Error(
        `Expected revert with ${errorName} but no custom error found in error chain: ${(err as any)?.shortMessage ?? (err as any)?.message}`,
      );
    });
  }

  // ─── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("has the correct name", async function () {
      const { token } = await deployToken();
      assert.equal(await token.read.name(), "OwneraERC20TestToken");
    });

    it("has the correct symbol", async function () {
      const { token } = await deployToken();
      assert.equal(await token.read.symbol(), "OERC20TT");
    });

    it("starts with zero total supply", async function () {
      const { token } = await deployToken();
      assert.equal(await token.read.totalSupply(), 0n);
    });

    it("grants DEFAULT_ADMIN_ROLE to the admin", async function () {
      const { token, DEFAULT_ADMIN_ROLE, adminWallet } = await deployToken();
      assert.equal(
        await token.read.hasRole([DEFAULT_ADMIN_ROLE, adminWallet.account.address]),
        true,
      );
    });

    it("grants MINTER_ROLE to the minter", async function () {
      const { token, MINTER_ROLE, minterWallet } = await deployToken();
      assert.equal(
        await token.read.hasRole([MINTER_ROLE, minterWallet.account.address]),
        true,
      );
    });

    it("does not grant MINTER_ROLE to the admin", async function () {
      const { token, MINTER_ROLE, adminWallet } = await deployToken();
      assert.equal(
        await token.read.hasRole([MINTER_ROLE, adminWallet.account.address]),
        false,
      );
    });
  });

  // ─── Minting ────────────────────────────────────────────────────────────────

  describe("Minting", function () {
    it("allows minter to mint tokens", async function () {
      const { token, tokenAsMinter, otherWallet } = await deployToken();

      // write.mint sends a real transaction signed by minterWallet.
      // We use write.* here (not simulateContract) because state must actually
      // change — balanceOf and totalSupply need to reflect the minted amount.
      await tokenAsMinter.write.mint([otherWallet.account.address, 1000n]);

      assert.equal(await token.read.balanceOf([otherWallet.account.address]), 1000n);
      assert.equal(await token.read.totalSupply(), 1000n);
    });

    it("emits a Transfer event from the zero address on mint", async function () {
      const { token, tokenAsMinter, otherWallet } = await deployToken();

      // emitWithArgs also uses write.* because it needs the transaction to be
      // mined so it can inspect the resulting logs.
      // getAddress() checksums the address to match viem's decoded log format.
      await viem.assertions.emitWithArgs(
        tokenAsMinter.write.mint([otherWallet.account.address, 1000n]),
        token,
        "Transfer",
        [zeroAddress, getAddress(otherWallet.account.address), 1000n],
      );
    });

    it("accumulates total supply across multiple mints", async function () {
      const { token, tokenAsMinter, otherWallet, anotherWallet } =
        await deployToken();

      await tokenAsMinter.write.mint([otherWallet.account.address, 500n]);
      await tokenAsMinter.write.mint([anotherWallet.account.address, 300n]);

      assert.equal(await token.read.totalSupply(), 800n);
    });

    it("reverts when called by a non-minter", async function () {
      const { token, otherWallet, MINTER_ROLE, publicClient } =
        await deployToken();

      // simulateContract runs eth_call as otherWallet. The call reverts before
      // any state changes, and the revert data comes back in the JSON-RPC
      // response on both in-process and HTTP networks.
      await assertRevertWithCustomError(
        publicClient.simulateContract({
          address: token.address,
          abi: token.abi,
          functionName: "mint",
          args: [otherWallet.account.address, 1000n],
          account: otherWallet.account.address,
        }),
        "AccessControlUnauthorizedAccount",
        [getAddress(otherWallet.account.address), MINTER_ROLE],
      );
    });

    it("reverts when called by admin without MINTER_ROLE", async function () {
      const { token, adminWallet, MINTER_ROLE, publicClient } =
        await deployToken();

      await assertRevertWithCustomError(
        publicClient.simulateContract({
          address: token.address,
          abi: token.abi,
          functionName: "mint",
          args: [adminWallet.account.address, 1000n],
          account: adminWallet.account.address,
        }),
        "AccessControlUnauthorizedAccount",
        [getAddress(adminWallet.account.address), MINTER_ROLE],
      );
    });
  });

  // ─── Role management ────────────────────────────────────────────────────────

  describe("Role management", function () {
    it("allows admin to grant MINTER_ROLE", async function () {
      const { token, tokenAsAdmin, otherWallet, MINTER_ROLE } =
        await deployToken();

      await tokenAsAdmin.write.grantRole([MINTER_ROLE, otherWallet.account.address]);

      assert.equal(
        await token.read.hasRole([MINTER_ROLE, otherWallet.account.address]),
        true,
      );
    });

    it("allows a newly granted minter to mint", async function () {
      const { token, tokenAsAdmin, tokenAsOther, otherWallet, anotherWallet, MINTER_ROLE } =
        await deployToken();

      await tokenAsAdmin.write.grantRole([MINTER_ROLE, otherWallet.account.address]);
      await tokenAsOther.write.mint([anotherWallet.account.address, 500n]);

      assert.equal(await token.read.balanceOf([anotherWallet.account.address]), 500n);
    });

    it("allows admin to revoke MINTER_ROLE", async function () {
      const { token, tokenAsAdmin, minterWallet, MINTER_ROLE } =
        await deployToken();

      await tokenAsAdmin.write.revokeRole([MINTER_ROLE, minterWallet.account.address]);

      assert.equal(
        await token.read.hasRole([MINTER_ROLE, minterWallet.account.address]),
        false,
      );
    });

    it("prevents a revoked minter from minting", async function () {
      const { token, tokenAsAdmin, minterWallet, otherWallet, MINTER_ROLE, publicClient } =
        await deployToken();

      // Revoke the role with a real transaction first (state must change).
      await tokenAsAdmin.write.revokeRole([MINTER_ROLE, minterWallet.account.address]);

      // Then simulate the mint as the now-revoked minter to verify the revert.
      await assertRevertWithCustomError(
        publicClient.simulateContract({
          address: token.address,
          abi: token.abi,
          functionName: "mint",
          args: [otherWallet.account.address, 1000n],
          account: minterWallet.account.address,
        }),
        "AccessControlUnauthorizedAccount",
        [getAddress(minterWallet.account.address), MINTER_ROLE],
      );
    });

    it("reverts when a non-admin tries to grant roles", async function () {
      const { token, otherWallet, MINTER_ROLE, DEFAULT_ADMIN_ROLE, publicClient } =
        await deployToken();

      await assertRevertWithCustomError(
        publicClient.simulateContract({
          address: token.address,
          abi: token.abi,
          functionName: "grantRole",
          args: [MINTER_ROLE, otherWallet.account.address],
          account: otherWallet.account.address,
        }),
        "AccessControlUnauthorizedAccount",
        [getAddress(otherWallet.account.address), DEFAULT_ADMIN_ROLE],
      );
    });

    it("allows admin to transfer the admin role", async function () {
      const { token, tokenAsAdmin, adminWallet, otherWallet, DEFAULT_ADMIN_ROLE } =
        await deployToken();

      await tokenAsAdmin.write.grantRole([DEFAULT_ADMIN_ROLE, otherWallet.account.address]);
      await tokenAsAdmin.write.revokeRole([DEFAULT_ADMIN_ROLE, adminWallet.account.address]);

      assert.equal(
        await token.read.hasRole([DEFAULT_ADMIN_ROLE, otherWallet.account.address]),
        true,
      );
      assert.equal(
        await token.read.hasRole([DEFAULT_ADMIN_ROLE, adminWallet.account.address]),
        false,
      );
    });
  });
});
