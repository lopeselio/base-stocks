// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Vm} from "forge-std/Vm.sol";
import {B20Mock} from "./B20Mock.sol";

/// @title B20ForkUtils
/// @notice Make Coinbase B20 tokens usable inside Foundry forks of Base.
/// @dev B20 tokens are native precompiles whose bytecode is the single byte 0xef, so a local EVM
///      reverts with OpcodeNotFound. `etchLive` fetches live state from the real chain over RPC and
///      replaces the code at the same address with a B20Mock seeded with that state.
library B20ForkUtils {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// @notice Etch a B20Mock over `token`, seeded from the live chain. Balances start empty; use `deal`.
    function etchLive(address token) internal returns (B20Mock mock) {
        string memory sym = abi.decode(_liveCall(token, abi.encodeWithSignature("symbol()")), (string));
        string memory nm = abi.decode(_liveCall(token, abi.encodeWithSignature("name()")), (string));
        uint8 dec = abi.decode(_liveCall(token, abi.encodeWithSignature("decimals()")), (uint8));
        uint256 mult = abi.decode(_liveCall(token, abi.encodeWithSignature("uiMultiplier()")), (uint256));
        uint256 supply = abi.decode(_liveCall(token, abi.encodeWithSignature("totalSupply()")), (uint256));
        uint256 pending = abi.decode(_liveCall(token, abi.encodeWithSignature("newUIMultiplier()")), (uint256));
        uint256 at = abi.decode(_liveCall(token, abi.encodeWithSignature("effectiveAt()")), (uint256));

        mock = etch(token, nm, sym, dec, mult);
        mock.__setTotalSupply(supply);
        if (at != 0) mock.__schedule(pending, at);
    }

    /// @notice Etch a B20Mock with explicit values (no RPC needed; works in non-fork tests too).
    function etch(address token, string memory nm, string memory sym, uint8 dec, uint256 mult)
        internal
        returns (B20Mock mock)
    {
        vm.etch(token, type(B20Mock).runtimeCode);
        mock = B20Mock(token);
        mock.__init(nm, sym, dec, mult);
    }

    /// @notice Give `to` exactly `amount` raw tokens on an etched mock.
    function deal(address token, address to, uint256 amount) internal {
        B20Mock m = B20Mock(token);
        uint256 cur = m.balanceOf(to);
        if (amount > cur) m.__mint(to, amount - cur);
        else if (amount < cur) m.__burn(to, cur - amount);
    }

    /// @dev eth_call against the forked RPC at the fork block, bypassing the local EVM.
    function _liveCall(address to, bytes memory data) private returns (bytes memory) {
        string memory params = string.concat(
            '[{"to":"', vm.toString(to), '","data":"', vm.toString(data), '"},"', _blockTag(), '"]'
        );
        return vm.rpc("eth_call", params);
    }

    function _blockTag() private view returns (string memory) {
        return _toHexQuantity(block.number);
    }

    function _toHexQuantity(uint256 v) private pure returns (string memory) {
        if (v == 0) return "0x0";
        bytes memory hexChars = "0123456789abcdef";
        uint256 len;
        for (uint256 t = v; t != 0; t >>= 4) len++;
        bytes memory out = new bytes(len + 2);
        out[0] = "0";
        out[1] = "x";
        for (uint256 i = len + 1; i > 1; i--) {
            out[i] = hexChars[v & 0xf];
            v >>= 4;
        }
        return string(out);
    }
}
