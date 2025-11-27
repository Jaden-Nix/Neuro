// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract NeuroNetRegistry {
    address public owner;
    
    struct AgentInfo {
        string name;
        string agentType;
        address creator;
        uint256 createdAt;
        uint256 lastHeartbeat;
        bool active;
    }
    
    mapping(bytes32 => AgentInfo) public agents;
    bytes32[] public agentIds;
    
    event AgentRegistered(bytes32 indexed agentId, string name, string agentType, address creator);
    event AgentHeartbeat(bytes32 indexed agentId, uint256 timestamp);
    event AgentDeactivated(bytes32 indexed agentId);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function registerAgent(string memory name, string memory agentType) external onlyOwner returns (bytes32) {
        bytes32 agentId = keccak256(abi.encodePacked(name, block.timestamp, msg.sender));
        
        agents[agentId] = AgentInfo({
            name: name,
            agentType: agentType,
            creator: msg.sender,
            createdAt: block.timestamp,
            lastHeartbeat: block.timestamp,
            active: true
        });
        
        agentIds.push(agentId);
        
        emit AgentRegistered(agentId, name, agentType, msg.sender);
        return agentId;
    }
    
    function heartbeat(bytes32 agentId) external onlyOwner {
        require(agents[agentId].active, "Agent not active");
        agents[agentId].lastHeartbeat = block.timestamp;
        emit AgentHeartbeat(agentId, block.timestamp);
    }
    
    function deactivateAgent(bytes32 agentId) external onlyOwner {
        require(agents[agentId].active, "Already inactive");
        agents[agentId].active = false;
        emit AgentDeactivated(agentId);
    }
    
    function getAgent(bytes32 agentId) external view returns (AgentInfo memory) {
        return agents[agentId];
    }
    
    function getAgentCount() external view returns (uint256) {
        return agentIds.length;
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
