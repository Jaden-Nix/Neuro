// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title MemoryVault
 * @dev On-chain storage for AI agent strategies, patterns, and learning milestones
 * @notice Part of NeuroNet Governor multi-agent DeFi governance system
 */
contract MemoryVault is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    enum StrategyType { SUCCESSFUL, BLOCKED, HIGH_RISK, LEARNED }
    
    struct MemoryEntry {
        bytes32 id;
        StrategyType strategyType;
        string description;
        string riskPattern;
        string simulationSummary;
        uint256 timestamp;
        address creator;
        string[] tags;
        bool isActive;
    }

    struct AgentScore {
        address agentAddress;
        uint256 score;
        uint256 lastUpdated;
    }

    Counters.Counter private _entryIds;
    
    mapping(bytes32 => MemoryEntry) public entries;
    mapping(bytes32 => mapping(address => uint256)) public agentScores;
    mapping(address => bytes32[]) public agentEntries;
    mapping(StrategyType => bytes32[]) public entriesByType;
    
    bytes32[] public allEntryIds;
    
    address[] public authorizedAgents;
    mapping(address => bool) public isAuthorizedAgent;

    event MemoryStored(
        bytes32 indexed id,
        StrategyType strategyType,
        string description,
        address indexed creator,
        uint256 timestamp
    );
    
    event AgentScoreUpdated(
        bytes32 indexed entryId,
        address indexed agent,
        uint256 score,
        uint256 timestamp
    );
    
    event AgentAuthorized(address indexed agent, uint256 timestamp);
    event AgentRevoked(address indexed agent, uint256 timestamp);
    event EntryDeactivated(bytes32 indexed id, uint256 timestamp);

    modifier onlyAuthorizedAgent() {
        require(isAuthorizedAgent[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor() {
        isAuthorizedAgent[msg.sender] = true;
        authorizedAgents.push(msg.sender);
    }

    /**
     * @dev Store a new memory entry
     * @param strategyType Type of strategy (0: successful, 1: blocked, 2: high-risk, 3: learned)
     * @param description Human-readable description of the memory
     * @param riskPattern Identified risk pattern
     * @param simulationSummary Summary of simulation results
     * @param tags Array of tags for categorization
     */
    function storeMemory(
        StrategyType strategyType,
        string calldata description,
        string calldata riskPattern,
        string calldata simulationSummary,
        string[] calldata tags
    ) external onlyAuthorizedAgent nonReentrant returns (bytes32) {
        _entryIds.increment();
        bytes32 entryId = keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            _entryIds.current()
        ));

        MemoryEntry storage entry = entries[entryId];
        entry.id = entryId;
        entry.strategyType = strategyType;
        entry.description = description;
        entry.riskPattern = riskPattern;
        entry.simulationSummary = simulationSummary;
        entry.timestamp = block.timestamp;
        entry.creator = msg.sender;
        entry.tags = tags;
        entry.isActive = true;

        allEntryIds.push(entryId);
        agentEntries[msg.sender].push(entryId);
        entriesByType[strategyType].push(entryId);

        emit MemoryStored(entryId, strategyType, description, msg.sender, block.timestamp);
        
        return entryId;
    }

    /**
     * @dev Update agent score for a memory entry
     * @param entryId The memory entry ID
     * @param agent The agent address
     * @param score The score to assign (0-100)
     */
    function updateAgentScore(
        bytes32 entryId,
        address agent,
        uint256 score
    ) external onlyAuthorizedAgent {
        require(entries[entryId].isActive, "Entry not active");
        require(score <= 100, "Score must be 0-100");
        
        agentScores[entryId][agent] = score;
        
        emit AgentScoreUpdated(entryId, agent, score, block.timestamp);
    }

    /**
     * @dev Deactivate a memory entry
     * @param entryId The memory entry ID to deactivate
     */
    function deactivateEntry(bytes32 entryId) external onlyAuthorizedAgent {
        require(entries[entryId].isActive, "Entry already inactive");
        entries[entryId].isActive = false;
        
        emit EntryDeactivated(entryId, block.timestamp);
    }

    /**
     * @dev Authorize a new agent
     * @param agent The agent address to authorize
     */
    function authorizeAgent(address agent) external onlyOwner {
        require(!isAuthorizedAgent[agent], "Already authorized");
        isAuthorizedAgent[agent] = true;
        authorizedAgents.push(agent);
        
        emit AgentAuthorized(agent, block.timestamp);
    }

    /**
     * @dev Revoke an agent's authorization
     * @param agent The agent address to revoke
     */
    function revokeAgent(address agent) external onlyOwner {
        require(isAuthorizedAgent[agent], "Not authorized");
        isAuthorizedAgent[agent] = false;
        
        emit AgentRevoked(agent, block.timestamp);
    }

    /**
     * @dev Get memory entry by ID
     * @param entryId The memory entry ID
     */
    function getEntry(bytes32 entryId) external view returns (
        StrategyType strategyType,
        string memory description,
        string memory riskPattern,
        string memory simulationSummary,
        uint256 timestamp,
        address creator,
        bool isActive
    ) {
        MemoryEntry storage entry = entries[entryId];
        return (
            entry.strategyType,
            entry.description,
            entry.riskPattern,
            entry.simulationSummary,
            entry.timestamp,
            entry.creator,
            entry.isActive
        );
    }

    /**
     * @dev Get entries by type
     * @param strategyType The strategy type to filter by
     */
    function getEntriesByType(StrategyType strategyType) external view returns (bytes32[] memory) {
        return entriesByType[strategyType];
    }

    /**
     * @dev Get entries by agent
     * @param agent The agent address
     */
    function getEntriesByAgent(address agent) external view returns (bytes32[] memory) {
        return agentEntries[agent];
    }

    /**
     * @dev Get all entry IDs
     */
    function getAllEntryIds() external view returns (bytes32[] memory) {
        return allEntryIds;
    }

    /**
     * @dev Get total entry count
     */
    function getTotalEntries() external view returns (uint256) {
        return allEntryIds.length;
    }

    /**
     * @dev Get authorized agents list
     */
    function getAuthorizedAgents() external view returns (address[] memory) {
        return authorizedAgents;
    }
}
