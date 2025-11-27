// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract NeuroNetHeartbeat {
    address public owner;
    
    uint256 public lastCheckpoint;
    uint256 public checkpointCount;
    
    struct Checkpoint {
        uint256 timestamp;
        bytes32 stateHash;
        string metadata;
    }
    
    mapping(uint256 => Checkpoint) public checkpoints;
    
    event CheckpointCreated(uint256 indexed id, bytes32 stateHash, uint256 timestamp);
    event Heartbeat(uint256 timestamp);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        lastCheckpoint = block.timestamp;
    }
    
    function createCheckpoint(bytes32 stateHash, string memory metadata) external onlyOwner returns (uint256) {
        uint256 id = checkpointCount++;
        
        checkpoints[id] = Checkpoint({
            timestamp: block.timestamp,
            stateHash: stateHash,
            metadata: metadata
        });
        
        lastCheckpoint = block.timestamp;
        
        emit CheckpointCreated(id, stateHash, block.timestamp);
        return id;
    }
    
    function heartbeat() external onlyOwner {
        lastCheckpoint = block.timestamp;
        emit Heartbeat(block.timestamp);
    }
    
    function getCheckpoint(uint256 id) external view returns (Checkpoint memory) {
        return checkpoints[id];
    }
    
    function getTimeSinceLastCheckpoint() external view returns (uint256) {
        return block.timestamp - lastCheckpoint;
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
