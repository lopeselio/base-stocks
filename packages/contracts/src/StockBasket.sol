// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {StockPriceLib} from "./StockPriceLib.sol";

/// @title StockBasket
/// @notice A fixed-composition basket of Coinbase tokenized stocks (B20), minted and redeemed in-kind
///         the way ETF creation units are.
/// @dev Design notes:
///      - Composition is a fixed amount of RAW B20 tokens per 1e18 basket units. Dividends are reinvested
///        by raising each token's UI multiplier, so every basket unit automatically represents more
///        underlying shares over time. No rebalancing and no keeper are needed.
///      - Mint and redeem never read an oracle. They work 24/7 (including when equity feeds are frozen
///        off-hours) and cannot be oracle-manipulated.
///      - Mint rounds up and redeem rounds down, so the vault always holds at least
///        `unitAmount * totalSupply / 1e18` of every component.
///      - Prices are used only by the `nav` view, which reports whether every feed is fresh.
contract StockBasket is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant UNIT = 1e18;
    uint256 public constant MAX_COMPONENTS = 32;

    struct Component {
        address token;
        /// @notice Raw B20 amount per 1e18 basket units.
        uint256 unitAmount;
        /// @notice Chainlink feed for pricing (address(0) = unpriced).
        address feed;
    }

    Component[] private _components;
    /// @notice Staleness bound used by `nav`.
    uint256 public immutable maxPriceAge;

    event Minted(address indexed caller, address indexed to, uint256 amount, uint256[] deposited);
    event Redeemed(address indexed caller, address indexed to, uint256 amount, uint256[] withdrawn);

    error EmptyBasket();
    error TooManyComponents();
    error LengthMismatch();
    error ZeroAmount();
    error ZeroAddress();
    error DuplicateComponent(address token);

    constructor(
        string memory name_,
        string memory symbol_,
        address[] memory tokens,
        uint256[] memory unitAmounts,
        address[] memory feeds,
        uint256 maxPriceAge_
    ) ERC20(name_, symbol_) {
        uint256 n = tokens.length;
        if (n == 0) revert EmptyBasket();
        if (n > MAX_COMPONENTS) revert TooManyComponents();
        if (unitAmounts.length != n || feeds.length != n) revert LengthMismatch();
        for (uint256 i; i < n; ++i) {
            if (tokens[i] == address(0)) revert ZeroAddress();
            if (unitAmounts[i] == 0) revert ZeroAmount();
            for (uint256 j; j < i; ++j) {
                if (tokens[j] == tokens[i]) revert DuplicateComponent(tokens[i]);
            }
            _components.push(Component(tokens[i], unitAmounts[i], feeds[i]));
        }
        maxPriceAge = maxPriceAge_;
    }

    // ------------------------------------------------------------------ views

    function components() external view returns (Component[] memory) {
        return _components;
    }

    function componentCount() external view returns (uint256) {
        return _components.length;
    }

    /// @notice Raw token amounts required to mint `amount` basket units (rounded up).
    function previewMint(uint256 amount) public view returns (uint256[] memory amounts) {
        uint256 n = _components.length;
        amounts = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            amounts[i] = Math.mulDiv(_components[i].unitAmount, amount, UNIT, Math.Rounding.Ceil);
        }
    }

    /// @notice Raw token amounts returned for redeeming `amount` basket units (rounded down).
    function previewRedeem(uint256 amount) public view returns (uint256[] memory amounts) {
        uint256 n = _components.length;
        amounts = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            amounts[i] = Math.mulDiv(_components[i].unitAmount, amount, UNIT);
        }
    }

    /// @notice Underlying shares per 1e18 basket units for each component; grows as dividends accrue.
    function sharesPerUnit() external view returns (uint256[] memory shares) {
        uint256 n = _components.length;
        shares = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            shares[i] = StockPriceLib.toShares(_components[i].token, _components[i].unitAmount);
        }
    }

    /// @notice USD value (18 decimals) of 1e18 basket units.
    /// @return navPerUnit Sum of priced components (unpriced or failing feeds contribute 0).
    /// @return allFresh False if any component is unpriced, stale or invalid. Do not settle against a
    ///         NAV unless this is true.
    function nav() external view returns (uint256 navPerUnit, bool allFresh) {
        allFresh = true;
        uint256 n = _components.length;
        for (uint256 i; i < n; ++i) {
            Component memory c = _components[i];
            if (c.feed == address(0)) {
                allFresh = false;
                continue;
            }
            (bool ok,,) = StockPriceLib.tryFreshPrice(c.feed, maxPriceAge);
            if (!ok) {
                allFresh = false;
                continue;
            }
            navPerUnit += StockPriceLib.valueOf(c.token, c.feed, c.unitAmount, maxPriceAge);
        }
    }

    // ------------------------------------------------------------------ mutations

    /// @notice Deposit the in-kind components (see `previewMint`) and mint `amount` basket units to `to`.
    function mint(uint256 amount, address to) external nonReentrant returns (uint256[] memory deposited) {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        deposited = previewMint(amount);
        for (uint256 i; i < deposited.length; ++i) {
            IERC20(_components[i].token).safeTransferFrom(msg.sender, address(this), deposited[i]);
        }
        _mint(to, amount);
        emit Minted(msg.sender, to, amount, deposited);
    }

    /// @notice Burn `amount` basket units from the caller and send the pro-rata components to `to`.
    function redeem(uint256 amount, address to) external nonReentrant returns (uint256[] memory withdrawn) {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        _burn(msg.sender, amount);
        withdrawn = previewRedeem(amount);
        for (uint256 i; i < withdrawn.length; ++i) {
            if (withdrawn[i] != 0) IERC20(_components[i].token).safeTransfer(to, withdrawn[i]);
        }
        emit Redeemed(msg.sender, to, amount, withdrawn);
    }
}
