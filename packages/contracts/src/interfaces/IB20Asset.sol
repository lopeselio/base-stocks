// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Read surface of a Coinbase B20 tokenized-stock asset on Base (ERC-20 + ERC-8056 UI multiplier).
/// @dev Selectors verified against docs.base.org. B20 assets are precompiles at 0xb2000000... addresses.
interface IB20Asset {
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);

    /// @notice Fixed-point scale of the multiplier (1e18).
    function WAD_PRECISION() external view returns (uint256);
    /// @notice Current UI multiplier (underlying shares per token), WAD-scaled.
    function uiMultiplier() external view returns (uint256);
    /// @notice Pending scheduled multiplier and when it takes effect (0 = none).
    function newUIMultiplier() external view returns (uint256);
    function effectiveAt() external view returns (uint256);
    /// @notice balanceOf(account) * uiMultiplier / 1e18.
    function balanceOfUI(address account) external view returns (uint256);
    function totalSupplyUI() external view returns (uint256);
    function toUIAmount(uint256 amount) external view returns (uint256);
    function fromUIAmount(uint256 uiAmount) external view returns (uint256);
}
