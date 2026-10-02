// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// Arctisans escrow. Money moves ONLY by the rules both parties agreed (see docs/SCOPE_v1.md, the 10 rules).
/// @notice Non-custodial job escrow. Owner can tune cap/fee/pause for NEW jobs only; no function moves escrowed funds.
contract ArctisanEscrow is ReentrancyGuardTransient, Ownable2Step, Pausable {
    using SafeERC20 for IERC20;

    enum Status { None, Proposed, Agreed, Funded, Active, Delivered, Settlement, Completed, Settled, Deadlocked, Abandoned, Cancelled }
    enum DeadlockRule { Split5050, ToClient, ToArtisan }

    struct Job {
        // slot 1
        address client;
        uint64 deadline;            // agreed delivery deadline (on-time flag)
        uint8 revisionsAllowed;
        uint8 revisionsUsed;
        uint8 nextMilestone;        // index into milestones[] awaiting approval
        uint8 milestoneCount;
        // slot 2
        address artisan;
        Status status;
        DeadlockRule deadlockRule;
        uint16 feeBps;              // snapshot at creation
        bool artisanProposed;       // invoice flow: artisan created, client funds = accept
        bool clientAgreed;
        bool artisanAgreed;
        // slot 3
        uint96 total;               // 6-dec USDC units
        uint96 released;            // paid out so far (to artisan, gross incl. fee)
        uint64 clockStart;          // lastUpdate (Active) | deliveredAt (Delivered) | settlementStart (Settlement)
        // slot 4
        uint96 upfront;             // released on start()
        uint96 offerToArtisan;      // current settlement offer (of remaining)
        address offerBy;            // 0 = no offer
        bytes32 termsHash;          // keccak256 of canonical off-chain agreement JSON
    }

    uint256 public constant SILENCE = 3 days;
    uint256 public constant DEADLOCK_WINDOW = 48 hours;
    uint16 public constant MAX_FEE_BPS = 500; // hard cap 5%
    uint8 public constant MAX_MILESTONES = 10;
    uint96 public constant MIN_JOB = 1e6; // $1 minimum

    IERC20 public immutable usdc;
    uint96 public maxJobAmount = 100e6; // $100
    uint16 public feeBps;               // default 0
    address public feeRecipient;
    uint256 public totalLocked;         // invariant: usdc.balanceOf(this) >= totalLocked (+ owed credits)
    uint256 public totalOwed;
    uint256 public nextJobId = 1;

    mapping(uint256 => Job) public jobs;
    mapping(uint256 => uint96[]) internal _milestones; // amounts released on each approval
    mapping(address => uint256) public owed;          // fallback credits when push fails (blocklist etc.)

    // ---- events (indexer + reputation are built from these alone) ----
    event JobProposed(uint256 indexed jobId, address indexed client, address indexed artisan, address proposer, bytes32 termsHash,
        uint96 total, uint96 upfront, uint96[] milestones, uint64 deadline, uint8 revisionsAllowed, DeadlockRule rule, uint16 feeBps);
    event TermsAgreed(uint256 indexed jobId, address indexed by, bytes32 termsHash);
    event JobFunded(uint256 indexed jobId, address indexed client, uint96 amount);
    event JobStarted(uint256 indexed jobId, address indexed artisan, uint64 at);
    event ProgressPosted(uint256 indexed jobId, address indexed artisan, bytes32 updateHash);
    event Delivered(uint256 indexed jobId, address indexed artisan, uint8 milestone, bytes32 deliveryHash, bool onTime);
    event RevisionRequested(uint256 indexed jobId, address indexed client, uint8 revisionsUsed, bytes32 noteHash);
    event Released(uint256 indexed jobId, address indexed to, uint8 milestone, uint96 net, uint96 fee); // milestone 255 = upfront
    event Refunded(uint256 indexed jobId, address indexed to, uint96 amount);
    event SettlementOpened(uint256 indexed jobId, address indexed by, uint8 reason, uint64 deadlockAt); // 0 voluntary,1 client silent
    event SplitOffered(uint256 indexed jobId, address indexed by, uint96 toArtisan, uint96 toClient);
    event JobClosed(uint256 indexed jobId, address indexed client, address indexed artisan, Status outcome,
        uint96 paidToArtisan, uint96 refundedToClient, bool onTime);
    event PayoutDeferred(address indexed to, uint256 amount);
    event ParamsChanged(uint96 maxJobAmount, uint16 feeBps, address feeRecipient);

    error BadState(); error NotParty(); error BadAmount(); error Expired(); error NotExpired(); error TermsMismatch();

    constructor(IERC20 _usdc, address _owner) Ownable(_owner) { usdc = _usdc; feeRecipient = _owner; }

    // ---------------- agreement ----------------
    function propose(address client, address artisan, bytes32 termsHash, uint96 upfront, uint96[] calldata milestones,
        uint64 deadline, uint8 revisionsAllowed, DeadlockRule rule) external whenNotPaused returns (uint256 id) {
        if (msg.sender != client && msg.sender != artisan) revert NotParty();
        if (client == artisan || client == address(0) || artisan == address(0)) revert NotParty();
        if (milestones.length == 0 || milestones.length > MAX_MILESTONES) revert BadAmount();
        uint256 sum = upfront;
        for (uint256 i; i < milestones.length; ++i) { if (milestones[i] == 0) revert BadAmount(); sum += milestones[i]; }
        if (sum < MIN_JOB || sum > maxJobAmount) revert BadAmount();
        if (deadline <= block.timestamp) revert Expired();
        id = nextJobId++;
        Job storage j = jobs[id];
        (j.client, j.artisan, j.termsHash, j.total, j.upfront) = (client, artisan, termsHash, uint96(sum), upfront);
        (j.deadline, j.revisionsAllowed, j.deadlockRule, j.feeBps) = (deadline, revisionsAllowed, rule, feeBps);
        j.milestoneCount = uint8(milestones.length);
        j.artisanProposed = msg.sender == artisan;
        if (msg.sender == client) j.clientAgreed = true; else j.artisanAgreed = true;
        j.status = Status.Proposed;
        _milestones[id] = milestones;
        emit JobProposed(id, client, artisan, msg.sender, termsHash, uint96(sum), upfront, milestones, deadline, revisionsAllowed, rule, feeBps);
    }

    /// Artisan accepts client's proposal (client accepts an invoice by calling fund()).
    function agree(uint256 id, bytes32 termsHash) external {
        Job storage j = jobs[id];
        if (j.status != Status.Proposed) revert BadState();
        if (termsHash != j.termsHash) revert TermsMismatch();
        if (msg.sender != j.artisan || j.artisanAgreed) revert NotParty();
        j.artisanAgreed = true; j.status = Status.Agreed;
        emit TermsAgreed(id, msg.sender, termsHash);
    }

    /// Client funds 100%. Requires prior approve(escrow, total). Funding == client's acceptance of termsHash.
    function fund(uint256 id, bytes32 termsHash) external nonReentrant whenNotPaused {
        Job storage j = jobs[id];
        if (msg.sender != j.client) revert NotParty();
        if (termsHash != j.termsHash) revert TermsMismatch();
        if (!(j.status == Status.Agreed || (j.status == Status.Proposed && j.artisanAgreed))) revert BadState();
        if (!j.clientAgreed) { j.clientAgreed = true; emit TermsAgreed(id, msg.sender, termsHash); }
        j.status = Status.Funded;
        totalLocked += j.total;
        usdc.safeTransferFrom(msg.sender, address(this), j.total); // exact amount; USDC has no transfer fee
        emit JobFunded(id, msg.sender, j.total);
    }

    /// Either party walks away before the artisan starts. Full refund if funded. Never paused.
    function cancel(uint256 id) external nonReentrant {
        Job storage j = jobs[id];
        if (msg.sender != j.client && msg.sender != j.artisan) revert NotParty();
        Status s = j.status;
        if (s != Status.Proposed && s != Status.Agreed && s != Status.Funded) revert BadState();
        j.status = Status.Cancelled;
        uint96 refund = s == Status.Funded ? j.total : 0;
        if (refund > 0) { totalLocked -= refund; _pay(j.client, refund); emit Refunded(id, j.client, refund); }
        emit JobClosed(id, j.client, j.artisan, Status.Cancelled, 0, refund, false);
    }

    // ---------------- work ----------------
    function start(uint256 id) external nonReentrant {
        Job storage j = jobs[id];
        if (msg.sender != j.artisan) revert NotParty();
        if (j.status != Status.Funded) revert BadState();
        j.status = Status.Active; j.clockStart = uint64(block.timestamp);
        emit JobStarted(id, msg.sender, uint64(block.timestamp));
        if (j.upfront > 0) _release(id, j, j.upfront, type(uint8).max);
    }

    function postProgress(uint256 id, bytes32 updateHash) external {
        Job storage j = jobs[id];
        if (msg.sender != j.artisan) revert NotParty();
        if (j.status != Status.Active) revert BadState();
        if (block.timestamp > j.clockStart + SILENCE) revert Expired(); // must poke() -> refund
        j.clockStart = uint64(block.timestamp);
        emit ProgressPosted(id, msg.sender, updateHash);
    }

    function deliver(uint256 id, bytes32 deliveryHash) external {
        Job storage j = jobs[id];
        if (msg.sender != j.artisan) revert NotParty();
        if (j.status != Status.Active) revert BadState();
        if (block.timestamp > j.clockStart + SILENCE) revert Expired();
        j.status = Status.Delivered; j.clockStart = uint64(block.timestamp);
        emit Delivered(id, msg.sender, j.nextMilestone, deliveryHash, block.timestamp <= j.deadline);
    }

    function requestRevision(uint256 id, bytes32 noteHash) external {
        Job storage j = jobs[id];
        if (msg.sender != j.client) revert NotParty();
        if (j.status != Status.Delivered) revert BadState();
        if (block.timestamp > j.clockStart + SILENCE) revert Expired();
        if (j.revisionsUsed >= j.revisionsAllowed) revert BadState(); // out of revisions: approve or openSettlement
        j.revisionsUsed++; j.status = Status.Active; j.clockStart = uint64(block.timestamp);
        emit RevisionRequested(id, msg.sender, j.revisionsUsed, noteHash);
    }

    /// Client approves current milestone. Allowed even after the 3-day window (it only benefits the artisan).
    function approveDelivery(uint256 id) external nonReentrant {
        Job storage j = jobs[id];
        if (msg.sender != j.client) revert NotParty();
        if (j.status != Status.Delivered) revert BadState();
        uint8 m = j.nextMilestone;
        j.nextMilestone = m + 1;
        if (m + 1 == j.milestoneCount) {
            j.status = Status.Completed;
            uint96 rest = j.total - j.released; // remainder-safe
            _release(id, j, rest, m);
            emit JobClosed(id, j.client, j.artisan, Status.Completed, j.released, 0, block.timestamp <= j.deadline);
        } else {
            j.status = Status.Active; j.clockStart = uint64(block.timestamp);
            _release(id, j, _milestones[id][m], m);
        }
    }

    // ---------------- timers: anyone may poke ----------------
    function poke(uint256 id) external nonReentrant {
        Job storage j = jobs[id];
        Status s = j.status;
        if (s == Status.Active) {
            if (block.timestamp <= j.clockStart + SILENCE) revert NotExpired();
            j.status = Status.Abandoned;
            uint96 refund = j.total - j.released;
            totalLocked -= refund;
            _pay(j.client, refund);
            emit Refunded(id, j.client, refund);
            emit JobClosed(id, j.client, j.artisan, Status.Abandoned, j.released, refund, false);
        } else if (s == Status.Delivered) {
            if (block.timestamp <= j.clockStart + SILENCE) revert NotExpired();
            _openSettlement(id, j, 1);
        } else if (s == Status.Settlement) {
            if (block.timestamp <= j.clockStart + DEADLOCK_WINDOW) revert NotExpired();
            uint96 frozen = j.total - j.released;
            uint96 toArtisan = j.deadlockRule == DeadlockRule.ToArtisan ? frozen
                : j.deadlockRule == DeadlockRule.ToClient ? 0 : frozen / 2; // odd micro-unit goes to client
            _closeSplit(id, j, toArtisan, Status.Deadlocked);
        } else revert BadState();
    }

    // ---------------- settlement ----------------
    function openSettlement(uint256 id) external {
        Job storage j = jobs[id];
        if (msg.sender != j.client && msg.sender != j.artisan) revert NotParty();
        if (j.status != Status.Active && j.status != Status.Delivered) revert BadState();
        if (block.timestamp > j.clockStart + SILENCE) revert Expired(); // expired timers must be poked
        _openSettlement(id, j, 0);
    }

    function offerSplit(uint256 id, uint96 toArtisan) external {
        Job storage j = jobs[id];
        if (msg.sender != j.client && msg.sender != j.artisan) revert NotParty();
        if (j.status != Status.Settlement) revert BadState();
        if (block.timestamp > j.clockStart + DEADLOCK_WINDOW) revert Expired();
        uint96 frozen = j.total - j.released;
        if (toArtisan > frozen) revert BadAmount();
        (j.offerBy, j.offerToArtisan) = (msg.sender, toArtisan);
        emit SplitOffered(id, msg.sender, toArtisan, frozen - toArtisan);
    }

    /// Counterparty accepts; must echo the amount to avoid offer-swap front-running.
    function acceptSplit(uint256 id, uint96 toArtisan) external nonReentrant {
        Job storage j = jobs[id];
        if (j.status != Status.Settlement || j.offerBy == address(0)) revert BadState();
        if (msg.sender != j.client && msg.sender != j.artisan) revert NotParty();
        if (msg.sender == j.offerBy) revert NotParty();
        if (block.timestamp > j.clockStart + DEADLOCK_WINDOW) revert Expired();
        if (toArtisan != j.offerToArtisan) revert TermsMismatch();
        _closeSplit(id, j, toArtisan, Status.Settled);
    }

    /// Pull fallback for payouts that could not be pushed (e.g. recipient blocklisted at that moment).
    function withdrawOwed() external nonReentrant {
        uint256 amt = owed[msg.sender];
        if (amt == 0) revert BadAmount();
        owed[msg.sender] = 0; totalOwed -= amt;
        usdc.safeTransfer(msg.sender, amt);
    }

    // ---------------- admin: parameters for NEW jobs only ----------------
    function setParams(uint96 _max, uint16 _feeBps, address _feeRecipient) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS || _feeRecipient == address(0) || _max == 0) revert BadAmount();
        (maxJobAmount, feeBps, feeRecipient) = (_max, _feeBps, _feeRecipient);
        emit ParamsChanged(_max, _feeBps, _feeRecipient);
    }
    function pause() external onlyOwner { _pause(); }     // blocks propose/fund only; every exit path stays open
    function unpause() external onlyOwner { _unpause(); }
    function renounceOwnership() public pure override { revert(); }

    function statusOf(uint256 id) external view returns (Status) { return jobs[id].status; }
    function milestonesOf(uint256 id) external view returns (uint96[] memory) { return _milestones[id]; }
    function isReviewable(uint256 id, address a, address b) external view returns (bool) {
        Job storage j = jobs[id];
        Status s = j.status;
        bool terminalPaid = s == Status.Completed || s == Status.Settled || s == Status.Deadlocked || s == Status.Abandoned;
        return terminalPaid && ((a == j.client && b == j.artisan) || (a == j.artisan && b == j.client));
    }

    // ---------------- internals ----------------
    function _openSettlement(uint256 id, Job storage j, uint8 reason) internal {
        j.status = Status.Settlement; j.clockStart = uint64(block.timestamp);
        (j.offerBy, j.offerToArtisan) = (address(0), 0);
        emit SettlementOpened(id, msg.sender, reason, uint64(block.timestamp + DEADLOCK_WINDOW));
    }

    function _closeSplit(uint256 id, Job storage j, uint96 toArtisan, Status outcome) internal {
        uint96 frozen = j.total - j.released;
        uint96 toClient = frozen - toArtisan;
        j.status = outcome;
        if (toArtisan > 0) _release(id, j, toArtisan, type(uint8).max - 1);
        if (toClient > 0) { totalLocked -= toClient; _pay(j.client, toClient); emit Refunded(id, j.client, toClient); }
        emit JobClosed(id, j.client, j.artisan, outcome, j.released, toClient, false);
    }

    function _release(uint256 id, Job storage j, uint96 gross, uint8 milestone) internal {
        j.released += gross;
        totalLocked -= gross;
        uint96 fee = uint96((uint256(gross) * j.feeBps) / 10_000); // rounds down, in artisan's favour
        uint96 net = gross - fee;
        if (fee > 0) _pay(feeRecipient, fee);
        _pay(j.artisan, net);
        emit Released(id, j.artisan, milestone, net, fee);
    }

    /// Push; if the transfer fails (blocklist / paused USDC) credit `owed` so the job state machine never gets stuck.
    function _pay(address to, uint256 amt) internal {
        if (amt == 0) return;
        if (!usdc.trySafeTransfer(to, amt)) { owed[to] += amt; totalOwed += amt; emit PayoutDeferred(to, amt); }
    }
}

