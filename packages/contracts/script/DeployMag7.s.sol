// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {BasketFactory} from "../src/BasketFactory.sol";

/// @notice Deploys a BasketFactory (unless FACTORY is set) and a Base Mag7 basket on Base mainnet.
/// Dry run:  forge script script/DeployMag7.s.sol --rpc-url $BASE_RPC_URL
/// Deploy:   forge script script/DeployMag7.s.sol --rpc-url $BASE_RPC_URL --account <keystore> --broadcast
contract DeployMag7 is Script {
    function run() external returns (address factory, address basket) {
        address[] memory tokens = new address[](7);
        tokens[0] = 0xb200000000000000000000C2e324d24d7eEcd1fb; // AAPLc
        tokens[1] = 0xb200000000000000000000d9192b6B456483C2E8; // AMZNc
        tokens[2] = 0xb2000000000000000000002D0BA3164cc74f58B7; // GOOGLc
        tokens[3] = 0xb2000000000000000000008bC8786B856E61707C; // METAc
        tokens[4] = 0xB200000000000000000000Ab99cFa739E253872B; // MSFTc
        tokens[5] = 0xb20000000000000000000078ee7ce2fE4908108C; // NVDAc
        tokens[6] = 0xb2000000000000000000001e800a7f5189430cD0; // TSLAc

        address[] memory feeds = new address[](7);
        feeds[0] = 0x787f13dEa48Db0897CbCDD985de77809D837F988;
        feeds[1] = 0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295;
        feeds[2] = 0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2;
        feeds[3] = 0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D;
        feeds[4] = 0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c;
        feeds[5] = 0x04689a41629776563E6822F76f2e57D148d28513;
        feeds[6] = 0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4;

        uint256[] memory units = new uint256[](7);
        for (uint256 i; i < 7; ++i) {
            units[i] = 0.1e8; // 0.1 of each stock per basket unit
        }

        factory = vm.envOr("FACTORY", address(0));
        vm.startBroadcast();
        if (factory == address(0)) factory = address(new BasketFactory());
        basket = BasketFactory(factory).createBasket("Base Mag7", "bMAG7", tokens, units, feeds, 4 days);
        vm.stopBroadcast();

        console2.log("BasketFactory:", factory);
        console2.log("bMAG7:", basket);
    }
}
