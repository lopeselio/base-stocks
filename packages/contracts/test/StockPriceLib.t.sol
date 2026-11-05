// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {StockPriceLib} from "../src/StockPriceLib.sol";
import {MockFeed} from "./mocks/MockFeed.sol";
import {MockB20} from "./mocks/MockB20.sol";

/// @dev External wrapper so reverts from the internal library can be asserted.
contract Harness {
    function fresh(address f, uint256 maxAge) external view returns (uint256 p, uint8 d) {
        return StockPriceLib.freshPrice(f, maxAge);
    }

    function tryFresh(address f, uint256 maxAge) external view returns (bool, uint256, uint256) {
        return StockPriceLib.tryFreshPrice(f, maxAge);
    }

    function value(address t, address f, uint256 amt, uint256 maxAge) external view returns (uint256) {
        return StockPriceLib.valueOf(t, f, amt, maxAge);
    }

    function shares(address t, uint256 amt) external view returns (uint256) {
        return StockPriceLib.toShares(t, amt);
    }

    function imminent(address t, uint256 w) external view returns (bool) {
        return StockPriceLib.multiplierChangeImminent(t, w);
    }
}

contract StockPriceLibTest is Test {
    Harness h;
    MockFeed feed;
    MockB20 token;

    function setUp() public {
        vm.warp(1_800_000_000);
        h = new Harness();
        feed = new MockFeed();
        token = new MockB20();
        feed.set(290_79462274, block.timestamp - 60);
    }

    function test_freshPrice() public view {
        (uint256 p, uint8 d) = h.fresh(address(feed), 1 hours);
        assertEq(p, 290_79462274);
        assertEq(d, 8);
    }

    function test_revertsWhenStale() public {
        feed.set(290e8, block.timestamp - 2 days);
        vm.expectRevert(
            abi.encodeWithSelector(StockPriceLib.StalePrice.selector, address(feed), block.timestamp - 2 days, 1 days)
        );
        h.fresh(address(feed), 1 days);
    }

    function test_revertsOnNonPositive() public {
        feed.set(0, block.timestamp);
        vm.expectRevert(abi.encodeWithSelector(StockPriceLib.InvalidPrice.selector, address(feed), int256(0)));
        h.fresh(address(feed), 1 days);
    }

    function test_revertsOnIncompleteRound() public {
        feed.setRounds(5, 4);
        vm.expectRevert(abi.encodeWithSelector(StockPriceLib.IncompleteRound.selector, address(feed)));
        h.fresh(address(feed), 1 days);
    }

    function test_tryFreshNeverReverts() public {
        feed.breakIt();
        (bool ok,,) = h.tryFresh(address(feed), 1 days);
        assertFalse(ok);
    }

    function test_valueOf18Decimals() public view {
        // 2 tokens * $290.79462274 = $581.58924548
        assertEq(h.value(address(token), address(feed), 2e8, 1 hours), 581.58924548e18);
    }

    function test_toSharesUsesMultiplier() public {
        token.setMultiplier(2e18);
        assertEq(h.shares(address(token), 5e8), 10e8);
    }

    function test_multiplierChangeImminent() public {
        assertFalse(h.imminent(address(token), 1 days));
        token.schedule(block.timestamp + 1 hours);
        assertTrue(h.imminent(address(token), 1 days));
        assertFalse(h.imminent(address(token), 30 minutes));
    }

    function testFuzz_valueScalesLinearly(uint64 amt, uint64 price) public {
        vm.assume(price > 0);
        feed.set(int256(uint256(price)), block.timestamp);
        assertEq(h.value(address(token), address(feed), amt, 1 hours), uint256(amt) * price * 1e2);
    }
}
