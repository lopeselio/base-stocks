// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {StockBasket} from "./StockBasket.sol";

/// @title BasketFactory
/// @notice Permissionless deployer and registry for StockBaskets. Anyone can launch an index of
///         Coinbase tokenized stocks; apps can enumerate every basket from one place.
contract BasketFactory {
    address[] private _baskets;
    mapping(address => bool) public isBasket;

    event BasketCreated(
        address indexed basket,
        address indexed creator,
        string name,
        string symbol,
        address[] tokens,
        uint256[] unitAmounts
    );

    function createBasket(
        string calldata name,
        string calldata symbol,
        address[] calldata tokens,
        uint256[] calldata unitAmounts,
        address[] calldata feeds,
        uint256 maxPriceAge
    ) external returns (address basket) {
        basket = address(new StockBasket(name, symbol, tokens, unitAmounts, feeds, maxPriceAge));
        _baskets.push(basket);
        isBasket[basket] = true;
        emit BasketCreated(basket, msg.sender, name, symbol, tokens, unitAmounts);
    }

    function basketCount() external view returns (uint256) {
        return _baskets.length;
    }

    /// @notice Paginated list of baskets.
    function baskets(uint256 offset, uint256 limit) external view returns (address[] memory page) {
        uint256 n = _baskets.length;
        if (offset >= n) return new address[](0);
        uint256 end = offset + limit > n ? n : offset + limit;
        page = new address[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = _baskets[i];
        }
    }
}
