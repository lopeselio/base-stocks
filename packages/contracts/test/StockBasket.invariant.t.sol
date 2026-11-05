// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StockBasket} from "../src/StockBasket.sol";
import {B20Mock} from "../src/testing/B20Mock.sol";

contract BasketHandler is Test {
    StockBasket public basket;
    B20Mock[] public stocks;
    address[] public actors;
    /// @notice Each mint (ceil) or redeem (floor) can leave < 1 raw unit of rounding dust per component.
    uint256 public roundingOps;

    constructor(StockBasket b, B20Mock[] memory s) {
        basket = b;
        stocks = s;
        for (uint256 i; i < 4; ++i) {
            address a = address(uint160(0xA11CE + i));
            actors.push(a);
            for (uint256 j; j < s.length; ++j) {
                s[j].__mint(a, 1e30);
                vm.prank(a);
                s[j].approve(address(b), type(uint256).max);
            }
        }
    }

    function mint(uint256 actorSeed, uint256 amount) external {
        address a = actors[actorSeed % actors.length];
        amount = bound(amount, 1, 1e24);
        vm.prank(a);
        basket.mint(amount, a);
        roundingOps++;
    }

    function redeem(uint256 actorSeed, uint256 amount) external {
        address a = actors[actorSeed % actors.length];
        uint256 bal = basket.balanceOf(a);
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        vm.prank(a);
        basket.redeem(amount, a);
        roundingOps++;
    }

    function transfer(uint256 fromSeed, uint256 toSeed, uint256 amount) external {
        address from = actors[fromSeed % actors.length];
        address to = actors[toSeed % actors.length];
        uint256 bal = basket.balanceOf(from);
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        vm.prank(from);
        basket.transfer(to, amount);
    }

    /// @dev Reinvested dividends raise multipliers; must never affect solvency in raw-token terms.
    function dividend(uint256 stockSeed, uint256 bps) external {
        B20Mock s = stocks[stockSeed % stocks.length];
        bps = bound(bps, 1, 500);
        s.__setMultiplier((s.uiMultiplier() * (10_000 + bps)) / 10_000);
    }
}

contract StockBasketInvariantTest is Test {
    StockBasket basket;
    B20Mock[] stocks;
    BasketHandler handler;

    function setUp() public {
        address[] memory tokens = new address[](3);
        uint256[] memory units = new uint256[](3);
        uint256[3] memory u = [uint256(0.5e8), 1e8, 33_333_333];
        for (uint256 i; i < 3; ++i) {
            B20Mock m = new B20Mock();
            m.__init("S", "S", 8, 1e18);
            stocks.push(m);
            tokens[i] = address(m);
            units[i] = u[i];
        }
        basket = new StockBasket("Inv", "INV", tokens, units, new address[](3), 1 days);
        handler = new BasketHandler(basket, stocks);
        targetContract(address(handler));
    }

    /// @notice The vault can always pay out every outstanding basket unit.
    function invariant_solvent() public view {
        uint256[] memory owed = basket.previewRedeem(basket.totalSupply());
        for (uint256 i; i < stocks.length; ++i) {
            assertGe(stocks[i].balanceOf(address(basket)), owed[i]);
        }
    }

    /// @notice Rounding dust is bounded: holdings exceed what is owed by at most one raw unit per op.
    function invariant_dustBounded() public view {
        uint256[] memory owed = basket.previewRedeem(basket.totalSupply());
        uint256 ops = handler.roundingOps();
        for (uint256 i; i < stocks.length; ++i) {
            assertLe(stocks[i].balanceOf(address(basket)), owed[i] + ops + 1);
        }
    }
}
