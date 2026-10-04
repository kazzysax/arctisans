// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
/// LOCAL TESTING ONLY. Deployed to a local anvil chain and copied to the real USDC address with anvil_setCode. Never deploy.
contract DevUSDC is ERC20("USDC", "USDC") {
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 a) external { _mint(to, a); }
}
