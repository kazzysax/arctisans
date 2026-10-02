// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ArctisanEscrow} from "../src/ArctisanEscrow.sol";
import {ArctisanSocial, IEscrowView} from "../src/ArctisanSocial.sol";

contract MockUSDC is ERC20("USDC", "USDC") {
    mapping(address => bool) public blocked;
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 a) external { _mint(to, a); }
    function setBlocked(address a, bool b) external { blocked[a] = b; }
    function _update(address f, address t, uint256 v) internal override { require(!blocked[f] && !blocked[t], "blocked"); super._update(f, t, v); }
}

contract Handler is Test {
    ArctisanEscrow e; MockUSDC u; address c = address(0xC1); address a = address(0xA1);
    uint256[] public ids;
    constructor(ArctisanEscrow _e, MockUSDC _u) { e = _e; u = _u; }
    function create(uint96 amt, uint96 up) public {
        amt = uint96(bound(amt, 1e6, 100e6)); up = uint96(bound(up, 0, amt - 1));
        uint96[] memory m = new uint96[](1); m[0] = amt - up;
        vm.prank(c); uint256 id = e.propose(c, a, bytes32("t"), up, m, uint64(block.timestamp + 7 days), 1, ArctisanEscrow.DeadlockRule.Split5050);
        vm.prank(a); e.agree(id, bytes32("t"));
        u.mint(c, amt); vm.startPrank(c); u.approve(address(e), amt); e.fund(id, bytes32("t")); vm.stopPrank();
        ids.push(id);
    }
    function _id(uint256 s) internal view returns (uint256) { return ids.length == 0 ? 0 : ids[s % ids.length]; }
    function start(uint256 s) public { uint256 id = _id(s); vm.prank(a); try e.start(id) {} catch {} }
    function deliver(uint256 s) public { uint256 id = _id(s); vm.prank(a); try e.deliver(id, bytes32("d")) {} catch {} }
    function approveD(uint256 s) public { uint256 id = _id(s); vm.prank(c); try e.approveDelivery(id) {} catch {} }
    function cancel(uint256 s) public { uint256 id = _id(s); vm.prank(c); try e.cancel(id) {} catch {} }
    function settle(uint256 s, uint96 x) public { uint256 id = _id(s); vm.prank(c); try e.openSettlement(id) {} catch {}
        vm.prank(a); try e.offerSplit(id, x % 50e6) {} catch {} vm.prank(c); try e.acceptSplit(id, x % 50e6) {} catch {} }
    function warp(uint256 t) public { vm.warp(block.timestamp + bound(t, 0, 4 days)); }
    function poke(uint256 s) public { try e.poke(_id(s)) {} catch {} }
    function block_(bool b) public { u.setBlocked(a, b); }
    function withdraw() public { vm.prank(a); try e.withdrawOwed() {} catch {} vm.prank(c); try e.withdrawOwed() {} catch {} }
}

contract EscrowTest is Test {
    ArctisanEscrow e; MockUSDC u; Handler h; ArctisanSocial s;
    address c = address(0xC1); address a = address(0xA1);
    function setUp() public {
        u = new MockUSDC(); e = new ArctisanEscrow(IERC20(address(u)), address(this));
        s = new ArctisanSocial(IERC20(address(u)), IEscrowView(address(e)));
        h = new Handler(e, u); targetContract(address(h));
    }
    function _job(uint96 up, uint96 rest) internal returns (uint256 id) {
        uint96[] memory m = new uint96[](1); m[0] = rest;
        vm.prank(c); id = e.propose(c, a, bytes32("t"), up, m, uint64(block.timestamp + 7 days), 2, ArctisanEscrow.DeadlockRule.Split5050);
        vm.prank(a); e.agree(id, bytes32("t"));
        u.mint(c, up + rest); vm.startPrank(c); u.approve(address(e), up + rest); e.fund(id, bytes32("t")); vm.stopPrank();
    }
    function test_happyPath5050() public {
        uint256 id = _job(50e6, 50e6);
        vm.prank(a); e.start(id); assertEq(u.balanceOf(a), 50e6);
        vm.prank(a); e.deliver(id, "d"); vm.prank(c); e.approveDelivery(id);
        assertEq(u.balanceOf(a), 100e6); assertEq(u.balanceOf(address(e)), 0);
        vm.prank(c); s.review(id, a, 5, "r");
        vm.prank(c); vm.expectRevert(); s.review(id, a, 5, "r");
    }
    function test_silenceRefund() public {
        uint256 id = _job(50e6, 50e6); vm.prank(a); e.start(id);
        vm.warp(block.timestamp + 3 days + 1); e.poke(id);
        assertEq(u.balanceOf(c), 50e6);
    }
    function test_clientSilentDeadlockSplit() public {
        uint256 id = _job(50e6, 49_999_999); vm.prank(a); e.start(id); vm.prank(a); e.deliver(id, "d");
        vm.warp(block.timestamp + 3 days + 1); e.poke(id); // -> settlement
        vm.warp(block.timestamp + 48 hours + 1); e.poke(id); // deadlock
        assertEq(u.balanceOf(a), 50e6 + 24_999_999); assertEq(u.balanceOf(c), 25_000_000);
    }
    function test_capAndAdminCannotTouch() public {
        uint96[] memory m = new uint96[](1); m[0] = 100e6 + 1;
        vm.prank(c); vm.expectRevert(); e.propose(c, a, "t", 0, m, 0, 0, ArctisanEscrow.DeadlockRule.ToClient);
        uint256 id = _job(0, 10e6); e.pause();
        vm.prank(c); e.cancel(id); assertEq(u.balanceOf(c), 10e6); // pause never traps exits
    }
    function test_blocklistDefers() public {
        uint256 id = _job(50e6, 50e6); u.setBlocked(a, true);
        vm.prank(a); e.start(id); assertEq(e.owed(a), 50e6);
        u.setBlocked(a, false); vm.prank(a); e.withdrawOwed(); assertEq(u.balanceOf(a), 50e6);
    }
    function invariant_solvent() public view {
        assertEq(u.balanceOf(address(e)), e.totalLocked() + e.totalOwed());
    }

    // ---- added: rules coverage ----
    function test_milestones3() public {
        uint96[] memory m = new uint96[](3); m[0] = 10e6; m[1] = 10e6; m[2] = 10e6;
        vm.prank(a); uint256 id = e.propose(c, a, "t", 0, m, uint64(block.timestamp + 7 days), 1, ArctisanEscrow.DeadlockRule.ToClient);
        u.mint(c, 30e6); vm.startPrank(c); u.approve(address(e), 30e6); e.fund(id, "t"); vm.stopPrank(); // invoice flow
        vm.prank(a); e.start(id);
        for (uint256 i; i < 3; i++) { vm.prank(a); e.deliver(id, "d"); vm.prank(c); e.approveDelivery(id); }
        assertEq(u.balanceOf(a), 30e6); assertEq(uint8(e.statusOf(id)), uint8(ArctisanEscrow.Status.Completed));
    }
    function test_minJobAndPastDeadline() public {
        uint96[] memory m = new uint96[](1); m[0] = 999_999;
        vm.prank(c); vm.expectRevert(); e.propose(c, a, "t", 0, m, uint64(block.timestamp + 1 days), 0, ArctisanEscrow.DeadlockRule.Split5050);
        m[0] = 5e6;
        vm.prank(c); vm.expectRevert(); e.propose(c, a, "t", 0, m, uint64(block.timestamp), 0, ArctisanEscrow.DeadlockRule.Split5050);
    }
    function test_wrongTermsCannotFund() public {
        uint96[] memory m = new uint96[](1); m[0] = 5e6;
        vm.prank(c); uint256 id = e.propose(c, a, "t", 0, m, uint64(block.timestamp + 1 days), 0, ArctisanEscrow.DeadlockRule.Split5050);
        vm.prank(a); vm.expectRevert(); e.agree(id, "other");
        vm.prank(address(0xBAD)); vm.expectRevert(); e.agree(id, "t");
    }
    function test_mutualSplit() public {
        uint256 id = _job(0, 40e6); vm.prank(a); e.start(id);
        vm.prank(c); e.openSettlement(id);
        vm.prank(c); e.offerSplit(id, 30e6);
        vm.prank(c); vm.expectRevert(); e.acceptSplit(id, 30e6); // offerer can't accept own
        vm.prank(a); vm.expectRevert(); e.acceptSplit(id, 40e6);  // must echo amount
        vm.prank(a); e.acceptSplit(id, 30e6);
        assertEq(u.balanceOf(a), 30e6); assertEq(u.balanceOf(c), 10e6);
    }
    function test_progressKeepsAlive() public {
        uint256 id = _job(50e6, 50e6); vm.prank(a); e.start(id);
        vm.warp(block.timestamp + 2 days); vm.prank(a); e.postProgress(id, "p");
        vm.warp(block.timestamp + 2 days); vm.expectRevert(); e.poke(id);
    }
    function test_revisionsLimited() public {
        uint256 id = _job(0, 10e6); vm.prank(a); e.start(id);
        for (uint256 i; i < 2; i++) { vm.prank(a); e.deliver(id, "d"); vm.prank(c); e.requestRevision(id, "n"); }
        vm.prank(a); e.deliver(id, "d"); vm.prank(c); vm.expectRevert(); e.requestRevision(id, "n");
    }
    function test_cancelledNotReviewable() public {
        uint256 id = _job(0, 10e6); vm.prank(c); e.cancel(id);
        vm.prank(c); vm.expectRevert(); s.review(id, a, 1, "r");
    }
    function test_tipDirect() public {
        u.mint(c, 2e6); vm.startPrank(c); u.approve(address(s), 2e6); s.tip(a, 2e6, "post"); vm.stopPrank();
        assertEq(u.balanceOf(a), 2e6); assertEq(u.balanceOf(address(s)), 0);
        vm.prank(c); vm.expectRevert(); s.tip(a, 1, "post");
    }
    function test_agentOwnership() public {
        address ag = address(0xA6);
        vm.prank(ag); s.setProfile("cid", true, c);
        assertFalse(s.isAccountableAgent(ag));
        vm.prank(c); s.confirmAgent(ag, true);
        assertTrue(s.isAccountableAgent(ag));
    }
    function test_strangerCannotMoveMoney() public {
        uint256 id = _job(50e6, 50e6); address x = address(0xBAD);
        vm.startPrank(x);
        vm.expectRevert(); e.start(id); vm.expectRevert(); e.cancel(id);
        vm.expectRevert(); e.approveDelivery(id); vm.expectRevert(); e.openSettlement(id);
        vm.stopPrank();
        vm.prank(x); vm.expectRevert(); e.setParams(100e6, 0, x);
    }
}