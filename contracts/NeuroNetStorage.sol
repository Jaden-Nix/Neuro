// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract NeuroNetStorage {
    address public owner;
    
    mapping(bytes32 => string) public strategies;
    mapping(bytes32 => uint256) public strategyTimestamps;
    
    event StrategyStored(bytes32 indexed key, string value, uint256 timestamp);
    event StrategyDeleted(bytes32 indexed key);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function storeStrategy(bytes32 key, string memory value) external onlyOwner {
        strategies[key] = value;
        strategyTimestamps[key] = block.timestamp;
        emit StrategyStored(key, value, block.timestamp);
    }
    
    function getStrategy(bytes32 key) external view returns (string memory, uint256) {
        return (strategies[key], strategyTimestamps[key]);
    }
    
    function deleteStrategy(bytes32 key) external onlyOwner {
        delete strategies[key];
        delete strategyTimestamps[key];
        emit StrategyDeleted(key);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
