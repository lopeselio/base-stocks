// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StockBasket} from "../src/StockBasket.sol";
import {B20Mock} from "../src/testing/B20Mock.sol";
import {MockFeed} from "./mocks/MockFeed.sol";

contract StockBasketTest is Test {
    StockBasket basket;
    B20Mock aapl;
    B20Mock nvda;
    B20Mock tsla;
    MockFeed aaplFeed;
    MockFeed nvdaFeed;
    MockFeed tslaFeed;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function _stock(string memory sym) internal returns (B20Mock m) {
        m = new B20Mock();
        m.__init(sym, sym, 8, 1e18);
    }

    function _feed(int256 px) internal returns (MockFeed f) {
        f = new MockFeed();
        f.set(px, block.timestamp);
    }

    function setUp() public {
        vm.warp(1_800_000_000);
        aapl = _stock("AAPLc");
        nvda = _stock("NVDAc");
        tsla = _stock("TSLAc");
        aaplFeed = _feed(350e8);
        nvdaFeed = _feed(200e8);
        tslaFeed = _feed(380e8);

        address[] memory tokens = new address[](3);
        (tokens[0], tokens[1], tokens[2]) = (address(aapl), address(nvda), address(tsla));
        uint256[] memory units = new uint256[](3);
        // 1 basket unit = 0.5 AAPLc + 1 NVDAc + 0.25 TSLAc
        (units[0], units[1], units[2]) = (0.5e8, 1e8, 0.25e8);
        address[] memory feeds = new address[](3);
        (feeds[0], feeds[1], feeds[2]) = (address(aaplFeed), address(nvdaFeed), address(tslaFeed));

        basket = new StockBasket("Base Tech 3", "BT3", tokens, units, feeds, 1 days);

        _fund(alice, 1_000e8);
        _fund(bob, 1_000e8);
    }

    function _fund(address who, uint256 amt) internal {
        aapl.__mint(who, amt);
        nvda.__mint(who, amt);
        tsla.__mint(who, amt);
        vm.startPrank(who);
        aapl.approve(address(basket), type(uint256).max);
        nvda.approve(address(basket), type(uint256).max);
        tsla.approve(address(basket), type(uint256).max);
        vm.stopPrank();
    }

    // ------------------------------------------------------------- construction

    function _deploy(address[] memory t, uint256[] memory u, address[] memory f) internal returns (StockBasket) {
        return new StockBasket("x", "x", t, u, f, 1 days);
    }

    function test_constructorValidates() public {
        address[] memory t = new address[](0);
        vm.expectRevert(StockBasket.EmptyBasket.selector);
        _deploy(t, new uint256[](0), new address[](0));

        t = new address[](2);
        (t[0], t[1]) = (address(aapl), address(aapl));
        uint256[] memory u = new uint256[](2);
        (u[0], u[1]) = (1, 1);
        vm.expectRevert(abi.encodeWithSelector(StockBasket.DuplicateComponent.selector, address(aapl)));
        _deploy(t, u, new address[](2));

        t[1] = address(nvda);
        u[1] = 0;
        vm.expectRevert(StockBasket.ZeroAmount.selector);
        _deploy(t, u, new address[](2));

        vm.expectRevert(StockBasket.LengthMismatch.selector);
        _deploy(t, u, new address[](1));
    }

    // ------------------------------------------------------------- mint / redeem

    function test_mintPullsExactComponents() public {
        vm.prank(alice);
        uint256[] memory dep = basket.mint(2e18, alice);
        assertEq(dep[0], 1e8);
        assertEq(dep[1], 2e8);
        assertEq(dep[2], 0.5e8);
        assertEq(basket.balanceOf(alice), 2e18);
        assertEq(aapl.balanceOf(address(basket)), 1e8);
        assertEq(nvda.balanceOf(address(basket)), 2e8);
        assertEq(tsla.balanceOf(address(basket)), 0.5e8);
    }

    function test_redeemReturnsComponents() public {
        vm.startPrank(alice);
        basket.mint(4e18, alice);
        basket.redeem(1e18, bob);
        vm.stopPrank();
        assertEq(basket.balanceOf(alice), 3e18);
        assertEq(aapl.balanceOf(bob), 1_000e8 + 0.5e8);
        assertEq(nvda.balanceOf(bob), 1_000e8 + 1e8);
        assertEq(tsla.balanceOf(bob), 1_000e8 + 0.25e8);
    }

    function test_dustMintRoundsUpAgainstMinter() public {
        // 1 wei of basket requires ceil(0.25e8 / 1e18) = 1 raw TSLAc
        uint256[] memory p = basket.previewMint(1);
        assertEq(p[0], 1);
        assertEq(p[1], 1);
        assertEq(p[2], 1);
        uint256[] memory r = basket.previewRedeem(1);
        assertEq(r[0], 0);
        assertEq(r[1], 0);
        assertEq(r[2], 0);
    }

    function test_revertsOnZero() public {
        vm.startPrank(alice);
        vm.expectRevert(StockBasket.ZeroAmount.selector);
        basket.mint(0, alice);
        vm.expectRevert(StockBasket.ZeroAddress.selector);
        basket.mint(1e18, address(0));
        vm.stopPrank();
    }

    function test_redeemMoreThanBalanceReverts() public {
        vm.prank(alice);
        basket.mint(1e18, alice);
        vm.prank(bob);
        vm.expectRevert();
        basket.redeem(1e18, bob);
    }

    function test_mintWorksWhenFeedsAreFrozen() public {
        vm.warp(block.timestamp + 30 days); // weekend / holiday: feeds stale
        (, bool fresh) = basket.nav();
        assertFalse(fresh);
        vm.prank(alice);
        basket.mint(1e18, alice); // in-kind: no oracle dependency
        assertEq(basket.totalSupply(), 1e18);
    }

    // ------------------------------------------------------------- dividends & NAV

    function test_dividendsAccrueViaMultiplier() public {
        uint256[] memory before = basket.sharesPerUnit();
        assertEq(before[0], 0.5e8);
        aapl.__setMultiplier(1.01e18); // 1% reinvested dividend
        uint256[] memory afterDiv = basket.sharesPerUnit();
        assertEq(afterDiv[0], 0.505e8);
        assertEq(afterDiv[1], before[1]);
    }

    function test_nav() public view {
        (uint256 v, bool fresh) = basket.nav();
        // 0.5*350 + 1*200 + 0.25*380 = 175 + 200 + 95 = 470
        assertEq(v, 470e18);
        assertTrue(fresh);
    }

    function test_navFlagsStaleComponent() public {
        tslaFeed.set(380e8, block.timestamp - 2 days);
        (uint256 v, bool fresh) = basket.nav();
        assertFalse(fresh);
        assertEq(v, 375e18); // TSLA excluded
    }

    // ------------------------------------------------------------- fuzz

    function testFuzz_roundTripNeverProfits(uint96 amount) public {
        vm.assume(amount > 0 && amount <= 100e18);
        uint256 a0 = aapl.balanceOf(alice);
        uint256 n0 = nvda.balanceOf(alice);
        uint256 t0 = tsla.balanceOf(alice);
        vm.startPrank(alice);
        basket.mint(amount, alice);
        basket.redeem(amount, alice);
        vm.stopPrank();
        assertLe(aapl.balanceOf(alice), a0);
        assertLe(nvda.balanceOf(alice), n0);
        assertLe(tsla.balanceOf(alice), t0);
        assertEq(basket.totalSupply(), 0);
    }

    function testFuzz_alwaysSolvent(uint96 m1, uint96 m2, uint96 r1) public {
        m1 = uint96(bound(m1, 1, 100e18));
        m2 = uint96(bound(m2, 1, 100e18));
        vm.prank(alice);
        basket.mint(m1, alice);
        vm.prank(bob);
        basket.mint(m2, bob);
        r1 = uint96(bound(r1, 1, m1));
        vm.prank(alice);
        basket.redeem(r1, alice);

        uint256[] memory owed = basket.previewRedeem(basket.totalSupply());
        assertGe(aapl.balanceOf(address(basket)), owed[0]);
        assertGe(nvda.balanceOf(address(basket)), owed[1]);
        assertGe(tsla.balanceOf(address(basket)), owed[2]);
    }
}
