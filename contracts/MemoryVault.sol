// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MemoryVault is Ownable, ReentrancyGuard {
    uint256 private _entryIdCounter;

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

    constructor() Ownable(msg.sender) {
        isAuthorizedAgent[msg.sender] = true;
        authorizedAgents.push(msg.sender);
    }

    function storeMemory(
        StrategyType strategyType,
        string calldata description,
        string calldata riskPattern,
        string calldata simulationSummary,
        string[] calldata tags
    ) external onlyAuthorizedAgent nonReentrant returns (bytes32) {
        _entryIdCounter++;
        bytes32 entryId = keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            _entryIdCounter
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

    function deactivateEntry(bytes32 entryId) external onlyAuthorizedAgent {
        require(entries[entryId].isActive, "Entry already inactive");
        entries[entryId].isActive = false;
        
        emit EntryDeactivated(entryId, block.timestamp);
    }

    function authorizeAgent(address agent) external onlyOwner {
        require(!isAuthorizedAgent[agent], "Already authorized");
        isAuthorizedAgent[agent] = true;
        authorizedAgents.push(agent);
        
        emit AgentAuthorized(agent, block.timestamp);
    }

    function revokeAgent(address agent) external onlyOwner {
        require(isAuthorizedAgent[agent], "Not authorized");
        isAuthorizedAgent[agent] = false;
        
        emit AgentRevoked(agent, block.timestamp);
    }

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

    function getEntriesByType(StrategyType strategyType) external view returns (bytes32[] memory) {
        return entriesByType[strategyType];
    }

    function getEntriesByAgent(address agent) external view returns (bytes32[] memory) {
        return agentEntries[agent];
    }

    function getAllEntryIds() external view returns (bytes32[] memory) {
        return allEntryIds;
    }

    function getTotalEntries() external view returns (uint256) {
        return allEntryIds.length;
    }

    function getAuthorizedAgents() external view returns (address[] memory) {
        return authorizedAgents;
    }
}
