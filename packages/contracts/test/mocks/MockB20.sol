// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockB20 {
    uint256 public uiMultiplier = 1e18;
    uint256 public effectiveAt;

    function setMultiplier(uint256 m) external {
        uiMultiplier = m;
    }

    function schedule(uint256 at) external {
        effectiveAt = at;
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }
}
