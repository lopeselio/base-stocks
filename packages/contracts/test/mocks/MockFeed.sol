// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockFeed {
    int256 public answer;
    uint256 public updatedAt;
    uint80 public roundId = 1;
    uint80 public answeredInRound = 1;
    bool public broken;

    function set(int256 a, uint256 t) external {
        answer = a;
        updatedAt = t;
    }

    function setRounds(uint80 r, uint80 ar) external {
        roundId = r;
        answeredInRound = ar;
    }

    function breakIt() external {
        broken = true;
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        require(!broken, "broken");
        return (roundId, answer, updatedAt, updatedAt, answeredInRound);
    }
}
