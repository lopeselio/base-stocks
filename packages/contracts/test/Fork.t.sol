// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {StockPriceLib} from "../src/StockPriceLib.sol";
import {IB20Asset} from "../src/interfaces/IB20Asset.sol";
import {B20ForkUtils} from "../src/testing/B20ForkUtils.sol";

contract ForkHarness {
    function value(address t, address f, uint256 amt, uint256 maxAge) external view returns (uint256) {
        return StockPriceLib.valueOf(t, f, amt, maxAge);
    }

    function tryFresh(address f, uint256 maxAge) external view returns (bool ok, uint256 p, uint256 at) {
        return StockPriceLib.tryFreshPrice(f, maxAge);
    }
}

/// @notice Runs against Base mainnet: `BASE_RPC_URL=https://mainnet.base.org forge test --mc ForkTest`
/// @dev Without BASE_RPC_URL these tests are no-ops.
contract ForkTest is Test {
    address constant GOOGLc = 0xb2000000000000000000002D0BA3164cc74f58B7;
    address constant GOOGL_FEED = 0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2;

    ForkHarness h;

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        h = new ForkHarness();
    }

    modifier onlyFork() {
        if (address(h) == address(0)) return;
        _;
    }

    function testFork_rawPrecompileIsNotExecutable() public onlyFork {
        assertEq(GOOGLc.code, hex"ef");
        vm.expectRevert();
        IB20Asset(GOOGLc).decimals();
    }

    function testFork_etchLiveMirrorsChainState() public onlyFork {
        B20ForkUtils.etchLive(GOOGLc);
        IB20Asset t = IB20Asset(GOOGLc);
        assertEq(t.symbol(), "GOOGLc");
        assertEq(t.decimals(), 8);
        assertEq(t.WAD_PRECISION(), 1e18);
        assertGt(t.uiMultiplier(), 1e18); // GOOGL has paid dividends
        assertGt(t.totalSupply(), 0);
    }

    function testFork_dealAndValue() public onlyFork {
        B20ForkUtils.etchLive(GOOGLc);
        address alice = makeAddr("alice");
        B20ForkUtils.deal(GOOGLc, alice, 3e8);
        assertEq(IB20Asset(GOOGLc).balanceOf(alice), 3e8);
        assertEq(IB20Asset(GOOGLc).balanceOfUI(alice), StockPriceLib.toShares(GOOGLc, 3e8));
        B20ForkUtils.deal(GOOGLc, alice, 1e8);
        assertEq(IB20Asset(GOOGLc).balanceOf(alice), 1e8);

        (bool ok, uint256 p,) = h.tryFresh(GOOGL_FEED, 7 days);
        assertTrue(ok);
        assertEq(h.value(GOOGLc, GOOGL_FEED, 1e8, 7 days), p * 1e10);
    }
}
