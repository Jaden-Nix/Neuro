// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title AgentRegistry
 * @dev On-chain registry for NeuroNet Governor AI agents with ATP compatibility
 * @notice Manages agent lifecycle, evolution, and credit economy on-chain
 */
contract AgentRegistry is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    enum AgentType { META, SCOUT, RISK, EXECUTION }
    enum AgentStatus { IDLE, ACTIVE, NEGOTIATING, EXECUTING, DEPRECATED }

    struct Agent {
        bytes32 id;
        AgentType agentType;
        AgentStatus status;
        string name;
        string description;
        uint256 version;
        uint256 creditScore;
        uint256 successfulActions;
        uint256 failedActions;
        uint256 spawnedAt;
        uint256 lastActiveAt;
        address owner;
        bytes32 spawnedFrom;
        string deprecationReason;
        string atpLink;
        bool isTokenized;
    }

    struct CreditTransaction {
        bytes32 agentId;
        int256 amount;
        string reason;
        uint256 timestamp;
    }

    Counters.Counter private _agentIds;
    Counters.Counter private _transactionIds;

    mapping(bytes32 => Agent) public agents;
    mapping(bytes32 => CreditTransaction[]) public creditHistory;
    mapping(address => bytes32[]) public ownerAgents;
    mapping(AgentType => bytes32[]) public agentsByType;
    
    bytes32[] public allAgentIds;

    uint256 public constant INITIAL_CREDITS = 500;
    uint256 public constant META_INITIAL_CREDITS = 1000;
    uint256 public constant DEPRECATION_THRESHOLD = 100;
    uint256 public constant MIN_ACCURACY_RATE = 60;

    event AgentRegistered(
        bytes32 indexed agentId,
        AgentType agentType,
        string name,
        address indexed owner,
        uint256 timestamp
    );

    event AgentStatusUpdated(
        bytes32 indexed agentId,
        AgentStatus oldStatus,
        AgentStatus newStatus,
        uint256 timestamp
    );

    event CreditAdjusted(
        bytes32 indexed agentId,
        int256 amount,
        string reason,
        uint256 newBalance,
        uint256 timestamp
    );

    event AgentEvolved(
        bytes32 indexed oldAgentId,
        bytes32 indexed newAgentId,
        uint256 newVersion,
        string reason,
        uint256 timestamp
    );

    event AgentDeprecated(
        bytes32 indexed agentId,
        string reason,
        uint256 timestamp
    );

    event AgentTokenized(
        bytes32 indexed agentId,
        string atpLink,
        uint256 timestamp
    );

    /**
     * @dev Register a new agent
     * @param agentType Type of agent (0: meta, 1: scout, 2: risk, 3: execution)
     * @param name Agent name
     * @param description Agent description
     */
    function registerAgent(
        AgentType agentType,
        string calldata name,
        string calldata description
    ) external nonReentrant returns (bytes32) {
        _agentIds.increment();
        bytes32 agentId = keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            _agentIds.current(),
            agentType
        ));

        uint256 initialCredits = agentType == AgentType.META 
            ? META_INITIAL_CREDITS 
            : INITIAL_CREDITS;

        Agent storage agent = agents[agentId];
        agent.id = agentId;
        agent.agentType = agentType;
        agent.status = AgentStatus.IDLE;
        agent.name = name;
        agent.description = description;
        agent.version = 1;
        agent.creditScore = initialCredits;
        agent.successfulActions = 0;
        agent.failedActions = 0;
        agent.spawnedAt = block.timestamp;
        agent.lastActiveAt = block.timestamp;
        agent.owner = msg.sender;
        agent.isTokenized = false;

        allAgentIds.push(agentId);
        ownerAgents[msg.sender].push(agentId);
        agentsByType[agentType].push(agentId);

        emit AgentRegistered(agentId, agentType, name, msg.sender, block.timestamp);
        
        return agentId;
    }

    /**
     * @dev Update agent status
     * @param agentId The agent ID
     * @param newStatus The new status
     */
    function updateStatus(bytes32 agentId, AgentStatus newStatus) external {
        Agent storage agent = agents[agentId];
        require(agent.id != bytes32(0), "Agent not found");
        require(agent.owner == msg.sender || msg.sender == owner(), "Not authorized");
        require(agent.status != AgentStatus.DEPRECATED, "Agent deprecated");

        AgentStatus oldStatus = agent.status;
        agent.status = newStatus;
        agent.lastActiveAt = block.timestamp;

        emit AgentStatusUpdated(agentId, oldStatus, newStatus, block.timestamp);
    }

    /**
     * @dev Adjust agent credits
     * @param agentId The agent ID
     * @param amount The credit adjustment (positive or negative)
     * @param reason The reason for adjustment
     */
    function adjustCredits(
        bytes32 agentId,
        int256 amount,
        string calldata reason
    ) external {
        Agent storage agent = agents[agentId];
        require(agent.id != bytes32(0), "Agent not found");
        require(agent.owner == msg.sender || msg.sender == owner(), "Not authorized");

        if (amount >= 0) {
            agent.creditScore += uint256(amount);
            agent.successfulActions++;
        } else {
            uint256 absAmount = uint256(-amount);
            if (absAmount > agent.creditScore) {
                agent.creditScore = 0;
            } else {
                agent.creditScore -= absAmount;
            }
            agent.failedActions++;
        }

        CreditTransaction memory txn = CreditTransaction({
            agentId: agentId,
            amount: amount,
            reason: reason,
            timestamp: block.timestamp
        });
        creditHistory[agentId].push(txn);

        emit CreditAdjusted(agentId, amount, reason, agent.creditScore, block.timestamp);

        if (shouldDeprecate(agentId)) {
            _deprecateAgent(agentId, "Performance below threshold");
        }
    }

    /**
     * @dev Evolve an agent to a new version
     * @param agentId The agent to evolve
     * @param improvements Description of improvements
     */
    function evolveAgent(
        bytes32 agentId,
        string calldata improvements
    ) external nonReentrant returns (bytes32) {
        Agent storage oldAgent = agents[agentId];
        require(oldAgent.id != bytes32(0), "Agent not found");
        require(oldAgent.owner == msg.sender || msg.sender == owner(), "Not authorized");

        _agentIds.increment();
        bytes32 newAgentId = keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            _agentIds.current(),
            oldAgent.agentType,
            "evolved"
        ));

        uint256 newVersion = oldAgent.version + 1;
        uint256 inheritedCredits = oldAgent.creditScore > INITIAL_CREDITS 
            ? oldAgent.creditScore 
            : INITIAL_CREDITS;

        Agent storage newAgent = agents[newAgentId];
        newAgent.id = newAgentId;
        newAgent.agentType = oldAgent.agentType;
        newAgent.status = AgentStatus.IDLE;
        newAgent.name = string(abi.encodePacked(oldAgent.name, " v", _toString(newVersion)));
        newAgent.description = string(abi.encodePacked(oldAgent.description, " | ", improvements));
        newAgent.version = newVersion;
        newAgent.creditScore = inheritedCredits;
        newAgent.successfulActions = 0;
        newAgent.failedActions = 0;
        newAgent.spawnedAt = block.timestamp;
        newAgent.lastActiveAt = block.timestamp;
        newAgent.owner = msg.sender;
        newAgent.spawnedFrom = agentId;
        newAgent.isTokenized = false;

        allAgentIds.push(newAgentId);
        ownerAgents[msg.sender].push(newAgentId);
        agentsByType[oldAgent.agentType].push(newAgentId);

        emit AgentEvolved(agentId, newAgentId, newVersion, improvements, block.timestamp);

        return newAgentId;
    }

    /**
     * @dev Set ATP link for tokenized agent
     * @param agentId The agent ID
     * @param atpLink The ATP platform link
     */
    function setATPLink(bytes32 agentId, string calldata atpLink) external {
        Agent storage agent = agents[agentId];
        require(agent.id != bytes32(0), "Agent not found");
        require(agent.owner == msg.sender || msg.sender == owner(), "Not authorized");

        agent.atpLink = atpLink;
        agent.isTokenized = true;

        emit AgentTokenized(agentId, atpLink, block.timestamp);
    }

    /**
     * @dev Check if agent should be deprecated
     * @param agentId The agent ID
     */
    function shouldDeprecate(bytes32 agentId) public view returns (bool) {
        Agent storage agent = agents[agentId];
        if (agent.id == bytes32(0) || agent.status == AgentStatus.DEPRECATED) {
            return false;
        }

        if (agent.creditScore < DEPRECATION_THRESHOLD) {
            return true;
        }

        uint256 totalActions = agent.successfulActions + agent.failedActions;
        if (totalActions > 10) {
            uint256 accuracyRate = (agent.successfulActions * 100) / totalActions;
            if (accuracyRate < MIN_ACCURACY_RATE) {
                return true;
            }
        }

        return false;
    }

    /**
     * @dev Internal function to deprecate an agent
     */
    function _deprecateAgent(bytes32 agentId, string memory reason) internal {
        Agent storage agent = agents[agentId];
        agent.status = AgentStatus.DEPRECATED;
        agent.deprecationReason = reason;

        emit AgentDeprecated(agentId, reason, block.timestamp);
    }

    /**
     * @dev Get agent details
     * @param agentId The agent ID
     */
    function getAgent(bytes32 agentId) external view returns (
        AgentType agentType,
        AgentStatus status,
        string memory name,
        uint256 version,
        uint256 creditScore,
        uint256 successfulActions,
        uint256 failedActions,
        bool isTokenized,
        string memory atpLink
    ) {
        Agent storage agent = agents[agentId];
        return (
            agent.agentType,
            agent.status,
            agent.name,
            agent.version,
            agent.creditScore,
            agent.successfulActions,
            agent.failedActions,
            agent.isTokenized,
            agent.atpLink
        );
    }

    /**
     * @dev Get credit history for an agent
     * @param agentId The agent ID
     */
    function getCreditHistory(bytes32 agentId) external view returns (CreditTransaction[] memory) {
        return creditHistory[agentId];
    }

    /**
     * @dev Get agents by type
     * @param agentType The agent type
     */
    function getAgentsByType(AgentType agentType) external view returns (bytes32[] memory) {
        return agentsByType[agentType];
    }

    /**
     * @dev Get agents by owner
     * @param agentOwner The owner address
     */
    function getAgentsByOwner(address agentOwner) external view returns (bytes32[] memory) {
        return ownerAgents[agentOwner];
    }

    /**
     * @dev Get all agent IDs
     */
    function getAllAgentIds() external view returns (bytes32[] memory) {
        return allAgentIds;
    }

    /**
     * @dev Get total agent count
     */
    function getTotalAgents() external view returns (uint256) {
        return allAgentIds.length;
    }

    /**
     * @dev Helper function to convert uint to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
