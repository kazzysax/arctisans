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
        amt = uint96(bound(amt, 1e6, 100e6)); up = uint96(bound(up, 0, amt / 2)); // pro artisan: <= 50% upfront
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
        _makePro(a); // most tests use upfront; the level tests below use fresh artisans
        h = new Handler(e, u); targetContract(address(h));
    }
    /// Build a real onchain record: verified + 20 completed $5 jobs for 10 different clients (no upfront).
    function _makePro(address art) internal {
        e.setVerified(art, true); _grind(art, 20, 10);
        uint256 b = u.balanceOf(art); vm.prank(art); u.transfer(address(0xdead), b); // start balance assertions from zero
    }
    function _grind(address art, uint256 n, uint256 nClients) internal {
        uint96[] memory m = new uint96[](1); m[0] = 5e6;
        for (uint256 i; i < n; i++) {
            address cl = address(uint160(0x1000 + (i % nClients)));
            vm.prank(cl); uint256 id = e.propose(cl, art, "g", 0, m, uint64(block.timestamp + 7 days), 0, ArctisanEscrow.DeadlockRule.Split5050);
            vm.prank(art); e.agree(id, "g");
            u.mint(cl, 5e6); vm.startPrank(cl); u.approve(address(e), 5e6); e.fund(id, "g"); vm.stopPrank();
            vm.prank(art); e.start(id); vm.prank(art); e.deliver(id, "d"); vm.prank(cl); e.approveDelivery(id);
        }
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
        uint256 id = _job(49_999_999, 50e6); vm.prank(a); e.start(id); vm.prank(a); e.deliver(id, "d"); // upfront must be <= 50%
        vm.warp(block.timestamp + 3 days + 1); e.poke(id); // -> settlement
        vm.warp(block.timestamp + 48 hours + 1); e.poke(id); // deadlock: frozen 50e6 split 50/50
        assertEq(u.balanceOf(a), 49_999_999 + 25e6); assertEq(u.balanceOf(c), 25e6);
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
        vm.prank(x); vm.expectRevert(); e.setVerified(x, true);
    }

    // ---- upfront levels + feeless ----
    function _propose(address art, uint96 up, uint96 rest) internal returns (bool ok) {
        uint96[] memory m = new uint96[](1); m[0] = rest;
        vm.prank(c);
        try e.propose(c, art, "t", up, m, uint64(block.timestamp + 7 days), 0, ArctisanEscrow.DeadlockRule.Split5050) { ok = true; } catch {}
    }
    function test_newArtisanNoUpfront() public {
        address n = address(0xA2);
        assertEq(e.upfrontCapBps(n), 0);
        assertFalse(_propose(n, 1e6, 9e6));   // any upfront refused
        assertTrue(_propose(n, 0, 10e6));     // paid on approval is always fine
    }
    function test_unverifiedRecordStillNoUpfront() public {
        address n = address(0xA3); _grind(n, 20, 10);
        assertEq(e.upfrontCapBps(n), 0);      // record alone is not enough
        e.setVerified(n, true); assertEq(e.upfrontCapBps(n), 5000);
    }
    function test_trustedLevel30() public {
        address n = address(0xA4); e.setVerified(n, true); _grind(n, 4, 3);
        assertEq(e.upfrontCapBps(n), 0);      // 4 jobs: not yet
        _grind(n, 1, 3); assertEq(e.upfrontCapBps(n), 3000);
        assertTrue(_propose(n, 3e6, 7e6));    // 30% ok
        assertFalse(_propose(n, 31e5, 69e5)); // 31% refused
    }
    function test_sameClientDoesNotCount() public {
        address n = address(0xA5); e.setVerified(n, true); _grind(n, 25, 1);
        assertEq(e.upfrontCapBps(n), 0);      // 25 jobs but one client
    }
    function test_smallJobsDoNotCount() public {
        address n = address(0xA7); e.setVerified(n, true);
        uint96[] memory m = new uint96[](1); m[0] = 4e6;
        for (uint256 i; i < 6; i++) {
            address cl = address(uint160(0x2000 + i));
            vm.prank(cl); uint256 id = e.propose(cl, n, "g", 0, m, uint64(block.timestamp + 7 days), 0, ArctisanEscrow.DeadlockRule.Split5050);
            vm.prank(n); e.agree(id, "g"); u.mint(cl, 4e6); vm.startPrank(cl); u.approve(address(e), 4e6); e.fund(id, "g"); vm.stopPrank();
            vm.prank(n); e.start(id); vm.prank(n); e.deliver(id, "d"); vm.prank(cl); e.approveDelivery(id);
        }
        (uint32 done,,,) = e.records(n); assertEq(done, 0);
    }
    function test_abandonLosesUpfrontForever() public {
        address n = address(0xA8); e.setVerified(n, true); _grind(n, 5, 3);
        assertEq(e.upfrontCapBps(n), 3000);
        uint96[] memory m = new uint96[](1); m[0] = 10e6;
        vm.prank(c); uint256 id = e.propose(c, n, "t", 0, m, uint64(block.timestamp + 7 days), 0, ArctisanEscrow.DeadlockRule.Split5050);
        vm.prank(n); e.agree(id, "t"); u.mint(c, 10e6); vm.startPrank(c); u.approve(address(e), 10e6); e.fund(id, "t"); vm.stopPrank();
        vm.prank(n); e.start(id); vm.warp(block.timestamp + 3 days + 1); e.poke(id);
        assertEq(e.upfrontCapBps(n), 0);
        _grind(n, 30, 15); assertEq(e.upfrontCapBps(n), 0);
    }
    function test_unverifyBlocksFunding() public {
        address n = address(0xA9); e.setVerified(n, true); _grind(n, 5, 3);
        assertTrue(_propose(n, 3e6, 7e6));
        uint256 id = e.nextJobId() - 1; vm.prank(n); e.agree(id, "t");
        e.setVerified(n, false);
        u.mint(c, 10e6); vm.startPrank(c); u.approve(address(e), 10e6);
        vm.expectRevert(ArctisanEscrow.UpfrontNotAllowed.selector); e.fund(id, "t"); vm.stopPrank();
        vm.prank(c); e.cancel(id); // still exits cleanly
    }
    function test_feelessForever() public {
        vm.expectRevert(); e.setParams(100e6, 1, address(this));
        assertEq(e.MAX_FEE_BPS(), 0); assertEq(e.feeBps(), 0);
        uint256 id = _job(0, 10e6); vm.prank(a); e.start(id); vm.prank(a); e.deliver(id, "d"); vm.prank(c); e.approveDelivery(id);
        assertEq(u.balanceOf(a), 10e6); // artisan receives every cent
    }
}