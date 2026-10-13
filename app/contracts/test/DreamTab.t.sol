// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DreamTab} from "../src/DreamTab.sol";

contract U is ERC20("USDC", "USDC") {
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 a) external { _mint(to, a); }
}

contract DreamTabHandler is Test {
    DreamTab t; U u; address op; address[3] users;
    bytes32[] public ids; uint256 public totalIn;
    constructor(DreamTab _t, U _u, address _op) { t = _t; u = _u; op = _op; for (uint256 i; i < 3; i++) users[i] = address(uint160(0xA00 + i)); }
    function dep(uint256 who, uint96 amt) public {
        who %= 3; amt = uint96(bound(amt, 500_000, 5_000_000));
        bytes32 id = keccak256(abi.encode(ids.length, who));
        u.mint(users[who], amt);
        vm.startPrank(users[who]); u.approve(address(t), amt);
        t.deposit(id, amt); vm.stopPrank(); ids.push(id); totalIn += amt;
    }
    function chg(uint256 i, uint96 amt, bytes32 step) public {
        if (ids.length == 0) return; bytes32 id = ids[i % ids.length]; amt = uint96(bound(amt, 1, 500_000));
        vm.prank(op); try t.charge(id, step, amt) {} catch {}
    }
    function wd(uint256 i) public {
        if (ids.length == 0) return; bytes32 id = ids[i % ids.length]; (address o,,,) = t.tabs(id);
        vm.prank(o); try t.withdraw(id) {} catch {}
    }
    function count() external view returns (uint256) { return ids.length; }
    function at(uint256 i) external view returns (bytes32) { return ids[i]; }
}

contract DreamTabTest is Test {
    U u; DreamTab t; address owner = address(0xB055); address op = address(0x0B); address tre = address(0x7E);
    address alice = address(0xA11CE); address bob = address(0xB0B);
    bytes32 id = keccak256("dream-1");

    function setUp() public {
        u = new U(); t = new DreamTab(IERC20(address(u)), owner, op, tre);
        u.mint(alice, 10e6); u.mint(bob, 10e6);
    }
    function _dep(address who, bytes32 i, uint96 amt) internal { vm.startPrank(who); u.approve(address(t), amt); t.deposit(i, amt); vm.stopPrank(); }

    function test_deposit_charge_withdraw() public {
        _dep(alice, id, 1e6);
        vm.prank(op); t.charge(id, "plan", 70_000);
        assertEq(u.balanceOf(tre), 70_000); assertEq(t.remaining(id), 930_000);
        vm.prank(alice); t.withdraw(id);
        assertEq(u.balanceOf(alice), 10e6 - 70_000); assertEq(t.remaining(id), 0); assertEq(u.balanceOf(address(t)), 0);
    }
    function test_withdraw_works_with_no_operator_action() public { _dep(alice, id, 1e6); vm.prank(alice); t.withdraw(id); assertEq(u.balanceOf(alice), 10e6); }
    function test_only_depositor_withdraws() public { _dep(alice, id, 1e6); vm.prank(bob); vm.expectRevert(DreamTab.NotOwnerOfTab.selector); t.withdraw(id); vm.prank(op); vm.expectRevert(DreamTab.NotOwnerOfTab.selector); t.withdraw(id); }
    function test_owner_cannot_withdraw_a_deposit() public { _dep(alice, id, 1e6); vm.prank(owner); vm.expectRevert(DreamTab.NotOwnerOfTab.selector); t.withdraw(id); }
    function test_only_operator_charges() public { _dep(alice, id, 1e6); vm.prank(bob); vm.expectRevert(DreamTab.NotOperator.selector); t.charge(id, "x", 1); vm.prank(alice); vm.expectRevert(DreamTab.NotOperator.selector); t.charge(id, "x", 1); vm.prank(owner); vm.expectRevert(DreamTab.NotOperator.selector); t.charge(id, "x", 1); }
    function test_step_charged_once() public { _dep(alice, id, 1e6); vm.startPrank(op); t.charge(id, "plan", 10_000); vm.expectRevert(DreamTab.StepDone.selector); t.charge(id, "plan", 10_000); vm.stopPrank(); }
    function test_cap_per_dream() public {
        _dep(alice, id, 5e6);
        vm.startPrank(op); t.charge(id, "a", 300_000); t.charge(id, "b", 100_000);
        vm.expectRevert(DreamTab.OverCap.selector); t.charge(id, "c", 1); vm.stopPrank();
        assertEq(t.remaining(id), 5e6 - 400_000);
    }
    function test_cannot_charge_more_than_left() public { _dep(alice, id, 500_000); vm.prank(alice); t.withdraw(id); vm.prank(op); vm.expectRevert(DreamTab.InsufficientTab.selector); t.charge(id, "a", 1); }
    function test_cannot_charge_unknown_tab() public { vm.prank(op); vm.expectRevert(DreamTab.Nothing.selector); t.charge(keccak256("nope"), "a", 1); }
    function test_zero_charge_refused() public { _dep(alice, id, 1e6); vm.prank(op); vm.expectRevert(DreamTab.Amount.selector); t.charge(id, "a", 0); }
    function test_one_tab_per_id_and_limits() public {
        _dep(alice, id, 1e6);
        vm.startPrank(bob); u.approve(address(t), 10e6);
        vm.expectRevert(DreamTab.Exists.selector); t.deposit(id, 1e6);
        vm.expectRevert(DreamTab.Amount.selector); t.deposit(keccak256("lo"), 499_999);
        vm.expectRevert(DreamTab.Amount.selector); t.deposit(keccak256("hi"), 5_000_001);
        vm.stopPrank();
    }
    function test_double_withdraw_refused() public { _dep(alice, id, 1e6); vm.startPrank(alice); t.withdraw(id); vm.expectRevert(DreamTab.Nothing.selector); t.withdraw(id); vm.stopPrank(); }
    function test_withdraw_after_partial_charges_and_charge_after_withdraw_blocked() public {
        _dep(alice, id, 1e6); vm.prank(op); t.charge(id, "a", 50_000);
        vm.prank(alice); t.withdraw(id);
        vm.prank(op); vm.expectRevert(DreamTab.InsufficientTab.selector); t.charge(id, "b", 1);
        assertEq(u.balanceOf(tre), 50_000);
    }
    function test_owner_can_rotate_operator_for_future_only() public {
        _dep(alice, id, 1e6); vm.prank(owner); t.setOperator(address(0x0C));
        vm.prank(op); vm.expectRevert(DreamTab.NotOperator.selector); t.charge(id, "a", 1);
        vm.prank(address(0x0C)); t.charge(id, "a", 1);
        vm.prank(bob); vm.expectRevert(); t.setOperator(bob);
        vm.prank(owner); vm.expectRevert(DreamTab.Zero.selector); t.setOperator(address(0));
    }
    function test_treasury_change_does_not_touch_deposits() public {
        _dep(alice, id, 1e6); vm.prank(owner); t.setTreasury(address(0x7F));
        vm.prank(op); t.charge(id, "a", 10_000); assertEq(u.balanceOf(address(0x7F)), 10_000);
        vm.prank(alice); t.withdraw(id); assertEq(u.balanceOf(alice), 10e6 - 10_000);
    }
    function testFuzz_money_always_adds_up(uint96 dep, uint96 c1, uint96 c2, bool withdrawFirst) public {
        dep = uint96(bound(dep, 500_000, 5_000_000)); c1 = uint96(bound(c1, 1, 400_000)); c2 = uint96(bound(c2, 1, 400_000));
        u.mint(alice, dep); uint256 before = u.balanceOf(alice);
        _dep(alice, id, dep);
        if (withdrawFirst) { vm.prank(alice); t.withdraw(id); }
        vm.startPrank(op);
        try t.charge(id, "a", c1) {} catch {}
        try t.charge(id, "b", c2) {} catch {}
        vm.stopPrank();
        if (t.remaining(id) > 0) { vm.prank(alice); t.withdraw(id); }
        assertEq(u.balanceOf(address(t)), 0);
        assertEq(u.balanceOf(alice) + u.balanceOf(tre), before);
        assertLe(u.balanceOf(tre), 400_000);
    }
}

contract DreamTabInvariant is Test {
    U u; DreamTab t; DreamTabHandler h; address tre = address(0x7E); address op = address(0x0B);
    function setUp() public {
        u = new U(); t = new DreamTab(IERC20(address(u)), address(0xB055), op, tre); h = new DreamTabHandler(t, u, op);
        targetContract(address(h));
    }
    /// Whatever sequence of deposits, charges and withdrawals runs: the contract holds exactly the sum of what is left on every tab, and no tab was charged past the cap.
    function invariant_balance_equals_remaining_and_cap_holds() public view {
        uint256 sum; uint256 n = h.count();
        for (uint256 i; i < n; i++) { bytes32 id = h.at(i); sum += t.remaining(id); (, , uint96 ch, ) = t.tabs(id); assertLe(ch, t.MAX_CHARGE()); }
        assertEq(u.balanceOf(address(t)), sum);
        assertEq(u.balanceOf(address(t)) + u.balanceOf(tre) + _withdrawn(), h.totalIn());
    }
    function _withdrawn() internal view returns (uint256 w) { for (uint256 i; i < h.count(); i++) { (, , , uint96 x) = t.tabs(h.at(i)); w += x; } }
}
