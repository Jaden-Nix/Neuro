// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title NeuronBadge - Soulbound Evolution Proof NFT
 * @notice Minted when agents successfully evolve, learn, or complete tasks
 * @dev Non-transferable (Soulbound) badges proving agent competence and growth
 * 
 * Badges are minted for:
 * - Successful evolution mutations
 * - Stress test completions
 * - Risk mitigation achievements
 * - Parliament governance decisions
 * - Performance milestones
 */
contract NeuronBadge is ERC721, ERC721URIStorage, ERC721Enumerable, Ownable, ReentrancyGuard {
    uint256 private _badgeIdCounter;
    
    enum BadgeType {
        EVOLUTION,          // Agent evolved to new generation
        STRESS_TEST,        // Successfully passed stress test
        RISK_MITIGATION,    // Successfully mitigated a risk
        GOVERNANCE,         // Participated in governance decision
        PERFORMANCE,        // Achieved performance milestone
        HEALING,            // Self-healed from failure
        LEARNING            // Learned new pattern/strategy
    }
    
    enum MutationType {
        THRESHOLD_ADJUSTMENT,
        RISK_REBALANCING,
        SOURCE_WEIGHT_SHIFT,
        NEW_SIGNAL_ENABLED,
        SIGNAL_DISABLED,
        LATENCY_OPTIMIZATION,
        FAILOVER_STRATEGY,
        CONFIDENCE_CALIBRATION,
        VOLATILITY_ADAPTATION,
        SLIPPAGE_OPTIMIZATION
    }
    
    struct EvolutionProof {
        bytes32 agentId;
        string agentName;
        uint256 generation;
        MutationType mutationType;
        string mutationDescription;
        uint256 riskScoreBefore;
        uint256 riskScoreAfter;
        uint256 creditDelta;
        string actionTag;
        string simulationId;
        uint256 timestamp;
        bytes32 transactionHash;
        string metadataURI;
    }
    
    struct BadgeMetadata {
        BadgeType badgeType;
        EvolutionProof proof;
        address mintedTo;
        uint256 mintedAt;
        bool isVerified;
        string chain;
    }
    
    mapping(uint256 => BadgeMetadata) public badgeMetadata;
    mapping(bytes32 => uint256[]) public agentBadges;
    mapping(address => uint256[]) public ownerBadges;
    mapping(string => uint256) public simulationBadges;
    
    uint256 public totalEvolutions;
    uint256 public totalStressTests;
    uint256 public totalHealings;
    
    mapping(bytes32 => uint256) public agentGenerations;
    mapping(bytes32 => uint256) public agentCreditScores;
    mapping(bytes32 => uint256) public agentSuccessCount;
    mapping(bytes32 => uint256) public agentFailureCount;
    
    event NeuronBadgeMinted(
        uint256 indexed badgeId,
        bytes32 indexed agentId,
        BadgeType badgeType,
        uint256 generation,
        MutationType mutationType,
        int256 creditDelta,
        uint256 timestamp
    );
    
    event AgentEvolved(
        bytes32 indexed agentId,
        uint256 fromGeneration,
        uint256 toGeneration,
        MutationType mutationType,
        string reason,
        uint256 timestamp
    );
    
    event AgentHealed(
        bytes32 indexed agentId,
        string failureType,
        string resolution,
        uint256 timestamp
    );
    
    event CreditUpdated(
        bytes32 indexed agentId,
        int256 delta,
        uint256 newBalance,
        string reason,
        uint256 timestamp
    );
    
    constructor() ERC721("NeuroNet Neuron Badge", "NEURON") Ownable(msg.sender) {}
    
    /**
     * @notice Mint a Neuron Badge for a successful evolution event
     * @param agentId The unique identifier of the agent
     * @param agentName Human-readable name of the agent
     * @param generation The new generation number
     * @param mutationType The type of mutation applied
     * @param mutationDescription Description of what changed
     * @param riskScoreBefore Risk score before evolution
     * @param riskScoreAfter Risk score after evolution
     * @param creditDelta Credit change from this evolution
     * @param actionTag Short tag describing the action
     * @param simulationId ID of the simulation that triggered evolution
     * @param metadataURI IPFS URI for full metadata
     */
    function mintEvolutionBadge(
        bytes32 agentId,
        string calldata agentName,
        uint256 generation,
        MutationType mutationType,
        string calldata mutationDescription,
        uint256 riskScoreBefore,
        uint256 riskScoreAfter,
        int256 creditDelta,
        string calldata actionTag,
        string calldata simulationId,
        string calldata metadataURI
    ) external onlyOwner nonReentrant returns (uint256) {
        _badgeIdCounter++;
        uint256 badgeId = _badgeIdCounter;
        
        EvolutionProof memory proof = EvolutionProof({
            agentId: agentId,
            agentName: agentName,
            generation: generation,
            mutationType: mutationType,
            mutationDescription: mutationDescription,
            riskScoreBefore: riskScoreBefore,
            riskScoreAfter: riskScoreAfter,
            creditDelta: creditDelta > 0 ? uint256(creditDelta) : 0,
            actionTag: actionTag,
            simulationId: simulationId,
            timestamp: block.timestamp,
            transactionHash: blockhash(block.number - 1),
            metadataURI: metadataURI
        });
        
        badgeMetadata[badgeId] = BadgeMetadata({
            badgeType: BadgeType.EVOLUTION,
            proof: proof,
            mintedTo: owner(),
            mintedAt: block.timestamp,
            isVerified: true,
            chain: "base"
        });
        
        _safeMint(owner(), badgeId);
        _setTokenURI(badgeId, metadataURI);
        
        agentBadges[agentId].push(badgeId);
        ownerBadges[owner()].push(badgeId);
        simulationBadges[simulationId] = badgeId;
        
        agentGenerations[agentId] = generation;
        if (creditDelta > 0) {
            agentCreditScores[agentId] += uint256(creditDelta);
            agentSuccessCount[agentId]++;
        } else {
            uint256 absDelta = uint256(-creditDelta);
            if (absDelta > agentCreditScores[agentId]) {
                agentCreditScores[agentId] = 0;
            } else {
                agentCreditScores[agentId] -= absDelta;
            }
            agentFailureCount[agentId]++;
        }
        
        totalEvolutions++;
        
        emit NeuronBadgeMinted(
            badgeId,
            agentId,
            BadgeType.EVOLUTION,
            generation,
            mutationType,
            creditDelta,
            block.timestamp
        );
        
        emit AgentEvolved(
            agentId,
            generation > 1 ? generation - 1 : 1,
            generation,
            mutationType,
            mutationDescription,
            block.timestamp
        );
        
        return badgeId;
    }
    
    /**
     * @notice Mint a badge for stress test completion
     */
    function mintStressTestBadge(
        bytes32 agentId,
        string calldata agentName,
        string calldata scenarioName,
        uint256 resilienceScore,
        bool passed,
        string calldata metadataURI
    ) external onlyOwner nonReentrant returns (uint256) {
        _badgeIdCounter++;
        uint256 badgeId = _badgeIdCounter;
        
        EvolutionProof memory proof = EvolutionProof({
            agentId: agentId,
            agentName: agentName,
            generation: agentGenerations[agentId],
            mutationType: MutationType.RISK_REBALANCING,
            mutationDescription: string(abi.encodePacked("Stress Test: ", scenarioName)),
            riskScoreBefore: 100,
            riskScoreAfter: resilienceScore,
            creditDelta: passed ? 10 : 0,
            actionTag: passed ? "STRESS_PASSED" : "STRESS_FAILED",
            simulationId: "",
            timestamp: block.timestamp,
            transactionHash: blockhash(block.number - 1),
            metadataURI: metadataURI
        });
        
        badgeMetadata[badgeId] = BadgeMetadata({
            badgeType: BadgeType.STRESS_TEST,
            proof: proof,
            mintedTo: owner(),
            mintedAt: block.timestamp,
            isVerified: true,
            chain: "base"
        });
        
        _safeMint(owner(), badgeId);
        _setTokenURI(badgeId, metadataURI);
        
        agentBadges[agentId].push(badgeId);
        totalStressTests++;
        
        emit NeuronBadgeMinted(
            badgeId,
            agentId,
            BadgeType.STRESS_TEST,
            agentGenerations[agentId],
            MutationType.RISK_REBALANCING,
            passed ? 10 : -5,
            block.timestamp
        );
        
        return badgeId;
    }
    
    /**
     * @notice Mint a healing badge when an agent self-heals from failure
     */
    function mintHealingBadge(
        bytes32 agentId,
        string calldata agentName,
        string calldata failureType,
        string calldata resolution,
        uint256 recoveryTime,
        string calldata metadataURI
    ) external onlyOwner nonReentrant returns (uint256) {
        _badgeIdCounter++;
        uint256 badgeId = _badgeIdCounter;
        
        EvolutionProof memory proof = EvolutionProof({
            agentId: agentId,
            agentName: agentName,
            generation: agentGenerations[agentId],
            mutationType: MutationType.FAILOVER_STRATEGY,
            mutationDescription: string(abi.encodePacked("Self-Healed: ", failureType, " -> ", resolution)),
            riskScoreBefore: 0,
            riskScoreAfter: 100,
            creditDelta: 15,
            actionTag: "SELF_HEALED",
            simulationId: "",
            timestamp: block.timestamp,
            transactionHash: blockhash(block.number - 1),
            metadataURI: metadataURI
        });
        
        badgeMetadata[badgeId] = BadgeMetadata({
            badgeType: BadgeType.HEALING,
            proof: proof,
            mintedTo: owner(),
            mintedAt: block.timestamp,
            isVerified: true,
            chain: "base"
        });
        
        _safeMint(owner(), badgeId);
        _setTokenURI(badgeId, metadataURI);
        
        agentBadges[agentId].push(badgeId);
        totalHealings++;
        
        emit NeuronBadgeMinted(
            badgeId,
            agentId,
            BadgeType.HEALING,
            agentGenerations[agentId],
            MutationType.FAILOVER_STRATEGY,
            15,
            block.timestamp
        );
        
        emit AgentHealed(agentId, failureType, resolution, block.timestamp);
        
        return badgeId;
    }
    
    /**
     * @notice Get all badges for an agent
     */
    function getAgentBadges(bytes32 agentId) external view returns (uint256[] memory) {
        return agentBadges[agentId];
    }
    
    /**
     * @notice Get agent's on-chain resume/stats
     */
    function getAgentResume(bytes32 agentId) external view returns (
        uint256 generation,
        uint256 creditScore,
        uint256 successCount,
        uint256 failureCount,
        uint256 badgeCount,
        uint256 accuracyRate
    ) {
        generation = agentGenerations[agentId];
        creditScore = agentCreditScores[agentId];
        successCount = agentSuccessCount[agentId];
        failureCount = agentFailureCount[agentId];
        badgeCount = agentBadges[agentId].length;
        
        uint256 totalActions = successCount + failureCount;
        accuracyRate = totalActions > 0 ? (successCount * 100) / totalActions : 0;
    }
    
    /**
     * @notice Get badge metadata
     */
    function getBadgeMetadata(uint256 badgeId) external view returns (BadgeMetadata memory) {
        require(_ownerOf(badgeId) != address(0), "Badge does not exist");
        return badgeMetadata[badgeId];
    }
    
    /**
     * @notice Get total platform stats
     */
    function getPlatformStats() external view returns (
        uint256 totalBadges,
        uint256 evolutions,
        uint256 stressTests,
        uint256 healings
    ) {
        return (_badgeIdCounter, totalEvolutions, totalStressTests, totalHealings);
    }
    
    /**
     * @notice Override transfer to make tokens soulbound (non-transferable)
     * @dev Tokens can only be minted, not transferred between addresses
     */
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        address from = _ownerOf(tokenId);
        
        if (from != address(0) && to != address(0)) {
            revert("NeuronBadge: Soulbound - transfers not allowed");
        }
        
        return super._update(to, tokenId, auth);
    }
    
    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
