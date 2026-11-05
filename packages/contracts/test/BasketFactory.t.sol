// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BasketFactory} from "../src/BasketFactory.sol";
import {StockBasket} from "../src/StockBasket.sol";
import {B20Mock} from "../src/testing/B20Mock.sol";

contract BasketFactoryTest is Test {
    BasketFactory factory;
    address[] tokens;
    uint256[] units;

    function setUp() public {
        factory = new BasketFactory();
        for (uint256 i; i < 2; ++i) {
            B20Mock m = new B20Mock();
            m.__init("S", "S", 8, 1e18);
            tokens.push(address(m));
            units.push(1e8);
        }
    }

    function test_createsAndRegisters() public {
        address b = factory.createBasket("Duo", "DUO", tokens, units, new address[](2), 1 days);
        assertTrue(factory.isBasket(b));
        assertEq(factory.basketCount(), 1);
        assertEq(StockBasket(b).symbol(), "DUO");
        assertEq(StockBasket(b).componentCount(), 2);
    }

    function test_pagination() public {
        for (uint256 i; i < 5; ++i) {
            factory.createBasket("B", "B", tokens, units, new address[](2), 1 days);
        }
        assertEq(factory.baskets(0, 2).length, 2);
        assertEq(factory.baskets(4, 10).length, 1);
        assertEq(factory.baskets(5, 10).length, 0);
    }

    function test_propagatesValidation() public {
        units[1] = 0;
        vm.expectRevert(StockBasket.ZeroAmount.selector);
        factory.createBasket("Bad", "BAD", tokens, units, new address[](2), 1 days);
    }
}
