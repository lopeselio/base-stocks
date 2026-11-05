// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {IB20Asset} from "./interfaces/IB20Asset.sol";

/// @title StockPriceLib
/// @notice Safe pricing helpers for Coinbase tokenized stocks on Base.
/// @dev Coinbase equity feeds publish 24/5 and HOLD their last value off-hours, so a stale check is
///      mandatory before settling, minting against, or liquidating a position.
///      Feed values are total-return values. This library treats them as per-token values
///      (they match the Coinbase API `nav_price`) and does not multiply by `uiMultiplier` again.
///      See docs/research.md.
library StockPriceLib {
    uint256 internal constant WAD = 1e18;

    error StalePrice(address feed, uint256 updatedAt, uint256 maxAge);
    error InvalidPrice(address feed, int256 answer);
    error IncompleteRound(address feed);

    /// @notice Latest feed answer, reverting if non-positive or older than `maxAge` seconds.
    function freshPrice(address feed, uint256 maxAge) internal view returns (uint256 price, uint8 decimals) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) =
            AggregatorV3Interface(feed).latestRoundData();
        if (answer <= 0) revert InvalidPrice(feed, answer);
        if (updatedAt == 0 || answeredInRound < roundId) revert IncompleteRound(feed);
        if (block.timestamp > updatedAt + maxAge) revert StalePrice(feed, updatedAt, maxAge);
        return (uint256(answer), AggregatorV3Interface(feed).decimals());
    }

    /// @notice Same as `freshPrice` but returns ok=false instead of reverting (for view UIs / health checks).
    function tryFreshPrice(address feed, uint256 maxAge) internal view returns (bool ok, uint256 price, uint256 updatedAt) {
        try AggregatorV3Interface(feed).latestRoundData() returns (
            uint80 roundId, int256 answer, uint256, uint256 _updatedAt, uint80 answeredInRound
        ) {
            ok = answer > 0 && _updatedAt != 0 && answeredInRound >= roundId && block.timestamp <= _updatedAt + maxAge;
            return (ok, answer > 0 ? uint256(answer) : 0, _updatedAt);
        } catch {
            return (false, 0, 0);
        }
    }

    /// @notice USD value (18 decimals) of `rawAmount` B20 tokens, using a fresh per-token feed value.
    function valueOf(address token, address feed, uint256 rawAmount, uint256 maxAge) internal view returns (uint256) {
        (uint256 price, uint8 feedDecimals) = freshPrice(feed, maxAge);
        uint8 tokenDecimals = IB20Asset(token).decimals();
        // rawAmount (tokenDecimals) * price (feedDecimals) -> 18 decimals
        return (rawAmount * price * WAD) / (10 ** (uint256(tokenDecimals) + feedDecimals));
    }

    /// @notice Underlying shares represented by `rawAmount` tokens (same decimals as the token).
    function toShares(address token, uint256 rawAmount) internal view returns (uint256) {
        return (rawAmount * IB20Asset(token).uiMultiplier()) / WAD;
    }

    /// @notice True when a multiplier change is scheduled within `window` seconds; integrators may want
    ///         to pause share-denominated logic around corporate actions.
    function multiplierChangeImminent(address token, uint256 window) internal view returns (bool) {
        uint256 at = IB20Asset(token).effectiveAt();
        return at != 0 && at >= block.timestamp && at <= block.timestamp + window;
    }
}
