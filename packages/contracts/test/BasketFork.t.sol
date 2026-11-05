// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {BasketFactory} from "../src/BasketFactory.sol";
import {StockBasket} from "../src/StockBasket.sol";
import {B20ForkUtils} from "../src/testing/B20ForkUtils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Mag7 basket on a Base mainnet fork with live B20 state and live Chainlink feeds.
///         `BASE_RPC_URL=https://mainnet.base.org forge test --mc BasketForkTest -vv`
contract BasketForkTest is Test {
    address[7] TOKENS = [
        0xb200000000000000000000C2e324d24d7eEcd1fb, // AAPLc
        0xb200000000000000000000d9192b6B456483C2E8, // AMZNc
        0xb2000000000000000000002D0BA3164cc74f58B7, // GOOGLc
        0xb2000000000000000000008bC8786B856E61707C, // METAc
        0xB200000000000000000000Ab99cFa739E253872B, // MSFTc
        0xb20000000000000000000078ee7ce2fE4908108C, // NVDAc
        0xb2000000000000000000001e800a7f5189430cD0 // TSLAc
    ];
    address[7] FEEDS = [
        0x787f13dEa48Db0897CbCDD985de77809D837F988,
        0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295,
        0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2,
        0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D,
        0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c,
        0x04689a41629776563E6822F76f2e57D148d28513,
        0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4
    ];

    StockBasket mag7;
    address alice = makeAddr("alice");

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);

        address[] memory tokens = new address[](7);
        uint256[] memory units = new uint256[](7);
        address[] memory feeds = new address[](7);
        for (uint256 i; i < 7; ++i) {
            B20ForkUtils.etchLive(TOKENS[i]);
            B20ForkUtils.deal(TOKENS[i], alice, 100e8);
            tokens[i] = TOKENS[i];
            units[i] = 0.1e8; // equal token count: 0.1 of each stock per basket unit
            feeds[i] = FEEDS[i];
        }
        BasketFactory factory = new BasketFactory();
        mag7 = StockBasket(factory.createBasket("Base Mag7", "bMAG7", tokens, units, feeds, 4 days));
    }

    modifier onlyFork() {
        if (address(mag7) == address(0)) return;
        _;
    }

    function testFork_mag7MintNavRedeem() public onlyFork {
        vm.startPrank(alice);
        for (uint256 i; i < 7; ++i) {
            IERC20(TOKENS[i]).approve(address(mag7), type(uint256).max);
        }
        mag7.mint(10e18, alice);
        vm.stopPrank();

        (uint256 navPerUnit, bool fresh) = mag7.nav();
        console2.log("bMAG7 NAV per unit (USD, 18dp):", navPerUnit);
        console2.log("all feeds fresh:", fresh);
        assertGt(navPerUnit, 50e18, "0.1 of each Mag7 stock should be worth > $50");
        assertLt(navPerUnit, 1_000e18);

        uint256[] memory shares = mag7.sharesPerUnit();
        assertGt(shares[2], 0.1e8, "GOOGLc has reinvested dividends, so shares > raw");

        vm.prank(alice);
        mag7.redeem(10e18, alice);
        for (uint256 i; i < 7; ++i) {
            assertEq(IERC20(TOKENS[i]).balanceOf(alice), 100e8);
        }
    }
}
