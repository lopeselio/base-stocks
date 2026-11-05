// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title B20Mock
/// @notice Test double for Coinbase B20 tokenized stocks. It mirrors the ERC-20 + ERC-8056 read and
///         transfer surface so it can be `vm.etch`ed over a real B20 address in a local fork,
///         where the native precompile cannot run.
/// @dev Etched code skips constructors, so state is set through `__init` and the `__set*` test hooks.
///      Not for production use.
contract B20Mock {
    uint256 public constant WAD_PRECISION = 1e18;

    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    uint256 public uiMultiplier;
    uint256 public newUIMultiplier;
    uint256 public effectiveAt;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function __init(string memory name_, string memory symbol_, uint8 decimals_, uint256 multiplier_) external {
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        uiMultiplier = multiplier_;
        newUIMultiplier = multiplier_;
    }

    // ---------------------------------------------------------------- test hooks
    function __mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function __burn(address from, uint256 amount) external {
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function __setTotalSupply(uint256 s) external {
        totalSupply = s;
    }

    function __setMultiplier(uint256 m) external {
        uiMultiplier = m;
        newUIMultiplier = m;
        effectiveAt = 0;
    }

    /// @notice Schedule a change; it becomes `uiMultiplier` once `block.timestamp >= at`, via `__poke`.
    function __schedule(uint256 m, uint256 at) external {
        newUIMultiplier = m;
        effectiveAt = at;
    }

    function __poke() external {
        if (effectiveAt != 0 && block.timestamp >= effectiveAt) {
            uiMultiplier = newUIMultiplier;
            effectiveAt = 0;
        }
    }

    // ---------------------------------------------------------------- ERC-8056 views
    function multiplier() external view returns (uint256) {
        return uiMultiplier;
    }

    function toUIAmount(uint256 amount) public view returns (uint256) {
        return (amount * uiMultiplier) / WAD_PRECISION;
    }

    function fromUIAmount(uint256 uiAmount) external view returns (uint256) {
        return (uiAmount * WAD_PRECISION) / uiMultiplier;
    }

    function balanceOfUI(address account) external view returns (uint256) {
        return toUIAmount(balanceOf[account]);
    }

    function scaledBalanceOf(address account) external view returns (uint256) {
        return toUIAmount(balanceOf[account]);
    }

    function totalSupplyUI() external view returns (uint256) {
        return toUIAmount(totalSupply);
    }

    // ---------------------------------------------------------------- ERC-20
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            require(a >= amount, "B20Mock: allowance");
            allowance[from][msg.sender] = a - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "B20Mock: balance");
        unchecked {
            balanceOf[from] -= amount;
        }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
