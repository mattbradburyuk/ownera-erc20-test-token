// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {OwneraERC20TestToken} from "./Ownera-ERC20-test-token.sol";

contract OwneraERC20TestTokenTest is Test {
    OwneraERC20TestToken token;

    address admin  = makeAddr("admin");
    address minter = makeAddr("minter");
    address alice  = makeAddr("alice");
    address bob    = makeAddr("bob");

    bytes32 constant MINTER_ROLE       = keccak256("MINTER_ROLE");
    bytes32 constant DEFAULT_ADMIN_ROLE = bytes32(0);

    function setUp() public {
        token = new OwneraERC20TestToken(admin, minter);
    }

    // ─── Deployment ───────────────────────────────────────────────────────────

    function test_name() public view {
        assertEq(token.name(), "OwneraERC20TestToken");
    }

    function test_symbol() public view {
        assertEq(token.symbol(), "OERC20TT");
    }

    function test_initialTotalSupplyIsZero() public view {
        assertEq(token.totalSupply(), 0);
    }

    function test_adminHasDefaultAdminRole() public view {
        assertTrue(token.hasRole(DEFAULT_ADMIN_ROLE, admin));
    }

    function test_minterHasMinterRole() public view {
        assertTrue(token.hasRole(MINTER_ROLE, minter));
    }

    // ─── Minting ──────────────────────────────────────────────────────────────

    function test_minterCanMint() public {
        vm.prank(minter);
        token.mint(alice, 1000);

        assertEq(token.balanceOf(alice), 1000);
        assertEq(token.totalSupply(), 1000);
    }

    function test_mintAccumulatesTotalSupply() public {
        vm.startPrank(minter);
        token.mint(alice, 500);
        token.mint(bob, 300);
        vm.stopPrank();

        assertEq(token.totalSupply(), 800);
    }

    function test_nonMinterCannotMint() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("AccessControlUnauthorizedAccount(address,bytes32)")),
                alice,
                MINTER_ROLE
            )
        );
        token.mint(alice, 1000);
    }

    function test_adminCannotMintWithoutMinterRole() public {
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("AccessControlUnauthorizedAccount(address,bytes32)")),
                admin,
                MINTER_ROLE
            )
        );
        token.mint(alice, 1000);
    }

    function testFuzz_minterCanMintAnyAmount(uint256 amount) public {
        vm.prank(minter);
        token.mint(alice, amount);

        assertEq(token.balanceOf(alice), amount);
        assertEq(token.totalSupply(), amount);
    }

    // ─── Role management ──────────────────────────────────────────────────────

    function test_adminCanGrantMinterRole() public {
        vm.prank(admin);
        token.grantRole(MINTER_ROLE, alice);

        assertTrue(token.hasRole(MINTER_ROLE, alice));
    }

    function test_adminCanRevokeMinterRole() public {
        vm.prank(admin);
        token.revokeRole(MINTER_ROLE, minter);

        assertFalse(token.hasRole(MINTER_ROLE, minter));
    }

    function test_revokedMinterCannotMint() public {
        vm.prank(admin);
        token.revokeRole(MINTER_ROLE, minter);

        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("AccessControlUnauthorizedAccount(address,bytes32)")),
                minter,
                MINTER_ROLE
            )
        );
        token.mint(alice, 1000);
    }

    function test_nonAdminCannotGrantRoles() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("AccessControlUnauthorizedAccount(address,bytes32)")),
                alice,
                DEFAULT_ADMIN_ROLE
            )
        );
        token.grantRole(MINTER_ROLE, alice);
    }

    function test_adminCanTransferAdminRole() public {
        vm.startPrank(admin);
        token.grantRole(DEFAULT_ADMIN_ROLE, alice);
        token.revokeRole(DEFAULT_ADMIN_ROLE, admin);
        vm.stopPrank();

        assertTrue(token.hasRole(DEFAULT_ADMIN_ROLE, alice));
        assertFalse(token.hasRole(DEFAULT_ADMIN_ROLE, admin));

        // New admin can now grant roles
        vm.prank(alice);
        token.grantRole(MINTER_ROLE, bob);
        assertTrue(token.hasRole(MINTER_ROLE, bob));
    }
}
