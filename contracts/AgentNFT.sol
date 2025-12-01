// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AgentNFT is ERC721, ERC721URIStorage, ERC721Enumerable, Ownable {
    uint256 private _tokenIdCounter;
    
    uint256 public mintPrice = 0.001 ether;
    uint256 public maxSupply = 10000;
    
    struct AgentMetadata {
        string templateId;
        string agentType;
        uint256 mintedAt;
        address originalMinter;
        bool isRented;
        address currentRenter;
        uint256 rentalExpiry;
    }
    
    mapping(uint256 => AgentMetadata) public agentMetadata;
    mapping(string => uint256[]) public templateTokens;
    
    event AgentMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string templateId,
        string agentType,
        uint256 timestamp
    );
    
    event AgentRented(
        uint256 indexed tokenId,
        address indexed renter,
        uint256 expiry,
        uint256 timestamp
    );
    
    event RentalEnded(
        uint256 indexed tokenId,
        address indexed previousRenter,
        uint256 timestamp
    );

    constructor() ERC721("NeuroNet Agent", "AGENT") Ownable(msg.sender) {}

    function mintAgent(
        string memory templateId,
        string memory agentType,
        string memory tokenURI_
    ) public payable returns (uint256) {
        require(msg.value >= mintPrice, "Insufficient payment");
        require(_tokenIdCounter < maxSupply, "Max supply reached");
        
        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;
        
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI_);
        
        agentMetadata[tokenId] = AgentMetadata({
            templateId: templateId,
            agentType: agentType,
            mintedAt: block.timestamp,
            originalMinter: msg.sender,
            isRented: false,
            currentRenter: address(0),
            rentalExpiry: 0
        });
        
        templateTokens[templateId].push(tokenId);
        
        emit AgentMinted(tokenId, msg.sender, templateId, agentType, block.timestamp);
        
        return tokenId;
    }
    
    uint256 public rentalPricePerDay = 0.0001 ether;
    
    mapping(uint256 => bool) public availableForRent;
    mapping(uint256 => uint256) public rentalPriceOverride;
    
    function setAvailableForRent(uint256 tokenId, bool available, uint256 pricePerDay) external {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Only owner can set availability");
        require(!agentMetadata[tokenId].isRented, "Currently rented");
        
        availableForRent[tokenId] = available;
        if (pricePerDay > 0) {
            rentalPriceOverride[tokenId] = pricePerDay;
        }
    }
    
    function getRentalPrice(uint256 tokenId, uint256 durationDays) public view returns (uint256) {
        uint256 pricePerDay = rentalPriceOverride[tokenId] > 0 ? rentalPriceOverride[tokenId] : rentalPricePerDay;
        return pricePerDay * durationDays;
    }
    
    function rentAgent(uint256 tokenId, uint256 durationDays) external payable {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(availableForRent[tokenId], "Agent not available for rent");
        require(!agentMetadata[tokenId].isRented, "Already rented");
        require(durationDays > 0 && durationDays <= 365, "Invalid rental duration");
        
        uint256 totalPrice = getRentalPrice(tokenId, durationDays);
        require(msg.value >= totalPrice, "Insufficient payment");
        
        uint256 expiry = block.timestamp + (durationDays * 1 days);
        
        agentMetadata[tokenId].isRented = true;
        agentMetadata[tokenId].currentRenter = msg.sender;
        agentMetadata[tokenId].rentalExpiry = expiry;
        availableForRent[tokenId] = false;
        
        address tokenOwner = ownerOf(tokenId);
        payable(tokenOwner).transfer(msg.value);
        
        emit AgentRented(tokenId, msg.sender, expiry, block.timestamp);
    }
    
    function endRental(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(agentMetadata[tokenId].isRented, "Not currently rented");
        
        address tokenOwner = ownerOf(tokenId);
        address currentRenter = agentMetadata[tokenId].currentRenter;
        bool isExpired = block.timestamp >= agentMetadata[tokenId].rentalExpiry;
        
        require(
            msg.sender == tokenOwner || 
            msg.sender == currentRenter ||
            isExpired,
            "Only owner, renter, or expired rental can end"
        );
        
        agentMetadata[tokenId].isRented = false;
        agentMetadata[tokenId].currentRenter = address(0);
        agentMetadata[tokenId].rentalExpiry = 0;
        availableForRent[tokenId] = true;
        
        emit RentalEnded(tokenId, currentRenter, block.timestamp);
    }
    
    function isRentalActive(uint256 tokenId) public view returns (bool) {
        if (!agentMetadata[tokenId].isRented) return false;
        return block.timestamp < agentMetadata[tokenId].rentalExpiry;
    }
    
    function getCurrentOperator(uint256 tokenId) public view returns (address) {
        if (isRentalActive(tokenId)) {
            return agentMetadata[tokenId].currentRenter;
        }
        return ownerOf(tokenId);
    }
    
    function getAgentMetadata(uint256 tokenId) public view returns (AgentMetadata memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return agentMetadata[tokenId];
    }
    
    function getTokensByTemplate(string memory templateId) public view returns (uint256[] memory) {
        return templateTokens[templateId];
    }
    
    function getTokensByOwner(address owner) public view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokens = new uint256[](balance);
        
        for (uint256 i = 0; i < balance; i++) {
            tokens[i] = tokenOfOwnerByIndex(owner, i);
        }
        
        return tokens;
    }
    
    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
    }
    
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }
    
    function totalMinted() public view returns (uint256) {
        return _tokenIdCounter;
    }

    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        if (agentMetadata[tokenId].isRented && auth != address(0)) {
            revert("Cannot transfer rented agent");
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
