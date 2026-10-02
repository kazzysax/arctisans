// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IEscrowView { function isReviewable(uint256 id, address a, address b) external view returns (bool); }

/// @notice Profiles, post hashes, tips and reviews. Holds no funds (tips go wallet -> artisan directly).
contract ArctisanSocial {
    using SafeERC20 for IERC20;
    IERC20 public immutable usdc;
    IEscrowView public immutable escrow;
    uint256 public constant MIN_TIP = 500_000; // $0.50

    struct Profile { string cid; address owner; bool isAgent; } // owner = accountable human for an agent (self for humans)
    mapping(address => Profile) public profiles;
    /// owner => agent => owner has confirmed responsibility for this agent wallet
    mapping(address => mapping(address => bool)) public ownerConfirmed;
    mapping(uint256 => mapping(address => bool)) public reviewed; // jobId => reviewer => done

    event ProfileSet(address indexed wallet, string cid, bool isAgent, address indexed owner);
    event AgentOwnerConfirmed(address indexed owner, address indexed agent, bool confirmed);
    event PostPublished(address indexed author, bytes32 indexed postHash, string cid);
    event Tipped(address indexed from, address indexed to, bytes32 indexed postHash, uint256 amount);
    event Reviewed(uint256 indexed jobId, address indexed reviewer, address indexed subject, uint8 rating, bytes32 reviewHash);

    error Bad();
    constructor(IERC20 _usdc, IEscrowView _escrow) { usdc = _usdc; escrow = _escrow; }

    function setProfile(string calldata cid, bool isAgent, address owner_) external {
        if (!isAgent) owner_ = msg.sender;
        if (owner_ == address(0)) revert Bad();
        profiles[msg.sender] = Profile(cid, owner_, isAgent);
        emit ProfileSet(msg.sender, cid, isAgent, owner_);
    }
    /// The human owner confirms (or revokes) responsibility for an agent wallet. Unconfirmed agents show as "unclaimed".
    function confirmAgent(address agent, bool ok) external {
        if (agent == address(0) || agent == msg.sender) revert Bad();
        ownerConfirmed[msg.sender][agent] = ok;
        emit AgentOwnerConfirmed(msg.sender, agent, ok);
    }
    function isAccountableAgent(address agent) external view returns (bool) {
        Profile storage p = profiles[agent];
        return p.isAgent && ownerConfirmed[p.owner][agent];
    }
    function publish(bytes32 postHash, string calldata cid) external { emit PostPublished(msg.sender, postHash, cid); }

    /// Requires approve(social, amount). Funds go straight to `to`; contract never holds them.
    function tip(address to, uint256 amount, bytes32 postHash) external {
        if (amount < MIN_TIP || to == address(0) || to == msg.sender) revert Bad();
        usdc.safeTransferFrom(msg.sender, to, amount);
        emit Tipped(msg.sender, to, postHash, amount);
    }

    function review(uint256 jobId, address subject, uint8 rating, bytes32 reviewHash) external {
        if (rating < 1 || rating > 5 || reviewed[jobId][msg.sender]) revert Bad();
        if (!escrow.isReviewable(jobId, msg.sender, subject)) revert Bad();
        reviewed[jobId][msg.sender] = true;
        emit Reviewed(jobId, msg.sender, subject, rating, reviewHash);
    }
}
