# ownera-ERC20-test-token

A test ERC-20 token deployed on Hedera testnet, used for Ownera Hedera adaptor testing.

**Contract:** `OwneraERC20TestToken` (symbol: `OERC20TT`, 18 decimals)  
**Deployed at:** `0x2723478C8B54238b8D2fa8d30749EC43e37AE540` (Hedera testnet, chain ID 296)

## Contract

Built with OpenZeppelin v5. Implements ERC-20 with role-based access control:

| Role | Capability |
|------|-----------|
| `DEFAULT_ADMIN_ROLE` | Grant and revoke roles |
| `MINTER_ROLE` | Call `mint(address, uint256)` |

Constructor: `(address defaultAdmin, address minter)`

## Setup

Fill in `.env` with your keys:

```
HEDERA_TESTNET_RPC_URL=https://testnet.hashio.io/api
HEDERA_TESTNET_DEPLOYER_PRIVATE_KEY=0x...
HEDERA_TESTNET_ADMIN_PRIVATE_KEY=0x...
HEDERA_TESTNET_MINTER_PRIVATE_KEY=0x...
HEDERA_TESTNET_USER1_PRIVATE_KEY=0x...
```

## Tasks

All tasks run with `npx hardhat <task> --network <network>`.

### `balance` — status overview

Prints balances, roles, and allowances for all tracked accounts. On Hedera networks, also resolves native Hedera account IDs via the mirror node.

```bash
npx hardhat balance --network hederatestnet
```

```
── Token: OERC20TT ──────────────────────────────────────────────
   Contract: 0x2723478C8B54238b8D2fa8d30749EC43e37AE540

+-----------+------------+--------------------------------------------+------------------+-------+--------+-----+
| Account   | Hedera ID  | EVM Address                                | Balance (OERC20TT) | Admin | Minter | Key |
+-----------+------------+--------------------------------------------+------------------+-------+--------+-----+
| Deployer  | 0.0.4680098| 0x1de5f1d073f93458397048231d76ab590675fa96 |              0.0 | ✓     | -      | ✓   |
...
```

### `mint` — mint tokens

Mints tokens to an account. Requires `MINTER_ROLE` (`HEDERA_TESTNET_MINTER_PRIVATE_KEY`).

```bash
npx hardhat mint --recipient <name|address> --amount <whole tokens> --network hederatestnet
```

`--recipient` accepts an account name from `config/trackedAccounts.json` or a raw `0x` address.

```bash
npx hardhat mint --recipient Holder1 --amount 1000 --network hederatestnet
npx hardhat mint --recipient 0x0000000000000000000000000000000000789efd --amount 500 --network hederatestnet
```

### `transfer` — transfer tokens

Transfers tokens between accounts. The `--from` account must have a private key in `.env`.

```bash
npx hardhat transfer --from <name|address> --to <name|address> --amount <whole tokens> --network hederatestnet
```

```bash
npx hardhat transfer --from Holder1 --to Admin --amount 100 --network hederatestnet
```

### `change-admin` — transfer DEFAULT_ADMIN_ROLE

Transfers `DEFAULT_ADMIN_ROLE` to another account. Auto-detects who currently holds the role by checking all tracked accounts on-chain, then grants to the new admin before revoking from the current one.

```bash
npx hardhat change-admin --network hederatestnet                    # defaults to "Admin"
npx hardhat change-admin --new-admin <name> --network hederatestnet
```

## Configuration

### `config/trackedAccounts.json`

Defines the accounts shown in `balance` and accepted by name in other tasks. Edit this file to add or remove accounts.

```json
{
  "accounts": [
    { "name": "Deployer", "address": "0x..." },
    { "name": "Admin",    "address": "0x..." }
  ],
  "allowances": [
    { "owner": "Holder1", "spender": "Minter" }
  ]
}
```

`allowances` — pairs whose current allowance will be shown in the `balance` output.

## Deployment

The contract is already deployed. To redeploy (e.g. to localhost):

```bash
npx hardhat ignition deploy ignition/modules/OwneraERC20TestToken.ts \
  --network localhost \
  --parameters ignition/parameters.localhost.json
```

Parameter files: `ignition/parameters.localhost.json`, `ignition/parameters.hederatestnet.json`

## Testing

```bash
npx hardhat test                          # in-process EDR (fast)
npx hardhat test --network localhost      # against a running local node
```

Tests live in `test/OwneraERC20TestToken.ts` (TypeScript, Node.js test runner).
