// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ArctisanEscrow} from "../src/ArctisanEscrow.sol";
import {ArctisanSocial, IEscrowView} from "../src/ArctisanSocial.sol";

/// forge script script/Deploy.s.sol --rpc-url $RPC --broadcast   (needs PRIVATE_KEY and OWNER in env)
/// Arc USDC ERC-20 interface: 0x3600000000000000000000000000000000000000 (6 decimals)
contract Deploy is Script {
    address constant USDC = 0x3600000000000000000000000000000000000000;
    function run() external {
        address owner = vm.envAddress("OWNER");
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        ArctisanEscrow e = new ArctisanEscrow(IERC20(USDC), owner);
        ArctisanSocial s = new ArctisanSocial(IERC20(USDC), IEscrowView(address(e)));
        vm.stopBroadcast();
        console.log("ESCROW_ADDRESS", address(e));
        console.log("SOCIAL_ADDRESS", address(s));
        console.log("START_BLOCK", block.number);
    }
}
