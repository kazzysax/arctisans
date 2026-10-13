// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// Arcdreams tab. A user deposits USDC for one dream. The operator (the Arctisans server) charges the cost of each step
/// BEFORE the step runs, and the depositor can withdraw whatever is left at any time, from their own wallet, even if the server is down.
/// Hard limits, enforced here and not by the server:
///  - the operator can never charge one dream more than MAX_CHARGE in total, nor more than what was deposited;
///  - a step id can be charged once per dream;
///  - charges go only to `treasury`; only the depositor can withdraw, and only to themselves;
///  - the owner can change the operator and treasury (future charges only). No function lets the owner touch a deposit.
contract DreamTab is ReentrancyGuardTransient, Ownable2Step {
    using SafeERC20 for IERC20;

    uint96 public constant MIN_DEPOSIT = 500_000;   // $0.50
    uint96 public constant MAX_DEPOSIT = 5_000_000; // $5
    uint96 public constant MAX_CHARGE = 400_000;    // $0.40 per dream, whatever the operator key does

    struct Tab { address owner; uint96 deposited; uint96 charged; uint96 withdrawn; }

    IERC20 public immutable usdc;
    address public operator;
    address public treasury;
    mapping(bytes32 => Tab) public tabs;
    mapping(bytes32 => mapping(bytes32 => bool)) public stepCharged;

    event Deposited(bytes32 indexed id, address indexed owner, uint96 amount);
    event Charged(bytes32 indexed id, bytes32 indexed step, uint96 amount);
    event Withdrawn(bytes32 indexed id, address indexed owner, uint96 amount);
    event OperatorSet(address operator);
    event TreasurySet(address treasury);

    error Exists(); error Amount(); error NotOperator(); error NotOwnerOfTab(); error Nothing();
    error OverCap(); error InsufficientTab(); error StepDone(); error Zero();

    constructor(IERC20 _usdc, address _owner, address _operator, address _treasury) Ownable(_owner) {
        if (address(_usdc) == address(0) || _operator == address(0) || _treasury == address(0)) revert Zero();
        usdc = _usdc; operator = _operator; treasury = _treasury;
    }

    function setOperator(address a) external onlyOwner { if (a == address(0)) revert Zero(); operator = a; emit OperatorSet(a); }
    function setTreasury(address a) external onlyOwner { if (a == address(0)) revert Zero(); treasury = a; emit TreasurySet(a); }

    function remaining(bytes32 id) public view returns (uint96) { Tab memory t = tabs[id]; return t.deposited - t.charged - t.withdrawn; }

    /// Caller must have approved `amount` USDC. One tab per id.
    function deposit(bytes32 id, uint96 amount) external nonReentrant {
        if (tabs[id].owner != address(0)) revert Exists();
        if (amount < MIN_DEPOSIT || amount > MAX_DEPOSIT) revert Amount();
        tabs[id] = Tab(msg.sender, amount, 0, 0);
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(id, msg.sender, amount);
    }

    function charge(bytes32 id, bytes32 step, uint96 amount) external nonReentrant {
        if (msg.sender != operator) revert NotOperator();
        Tab storage t = tabs[id];
        if (t.owner == address(0)) revert Nothing();
        if (amount == 0) revert Amount();
        if (stepCharged[id][step]) revert StepDone();
        if (uint256(t.charged) + amount > MAX_CHARGE) revert OverCap();
        if (amount > t.deposited - t.charged - t.withdrawn) revert InsufficientTab();
        stepCharged[id][step] = true;
        t.charged += amount;
        usdc.safeTransfer(treasury, amount);
        emit Charged(id, step, amount);
    }

    /// Everything not yet charged goes back to the depositor.
    function withdraw(bytes32 id) external nonReentrant {
        Tab storage t = tabs[id];
        if (msg.sender != t.owner) revert NotOwnerOfTab();
        uint96 left = t.deposited - t.charged - t.withdrawn;
        if (left == 0) revert Nothing();
        t.withdrawn += left;
        usdc.safeTransfer(msg.sender, left);
        emit Withdrawn(id, msg.sender, left);
    }
}
