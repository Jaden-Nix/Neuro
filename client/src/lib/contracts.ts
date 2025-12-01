import { parseAbi, type Address } from "viem";
import { sepolia, baseSepolia } from "wagmi/chains";

export const AGENT_NFT_ABI = [
  {
    inputs: [
      { name: "templateId", type: "string" },
      { name: "agentType", type: "string" },
      { name: "tokenURI_", type: "string" },
    ],
    name: "mintAgent",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "available", type: "bool" },
      { name: "pricePerDay", type: "uint256" },
    ],
    name: "setAvailableForRent",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "durationDays", type: "uint256" },
    ],
    name: "getRentalPrice",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "durationDays", type: "uint256" },
    ],
    name: "rentAgent",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "availableForRent",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "rentalPricePerDay",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "endRental",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "isRentalActive",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getCurrentOperator",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getAgentMetadata",
    outputs: [
      {
        components: [
          { name: "templateId", type: "string" },
          { name: "agentType", type: "string" },
          { name: "mintedAt", type: "uint256" },
          { name: "originalMinter", type: "address" },
          { name: "isRented", type: "bool" },
          { name: "currentRenter", type: "address" },
          { name: "rentalExpiry", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "getTokensByOwner",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "templateId", type: "string" }],
    name: "getTokensByTemplate",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalMinted",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "mintPrice",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: true, name: "owner", type: "address" },
      { indexed: false, name: "templateId", type: "string" },
      { indexed: false, name: "agentType", type: "string" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "AgentMinted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: true, name: "renter", type: "address" },
      { indexed: false, name: "expiry", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "AgentRented",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: true, name: "previousRenter", type: "address" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "RentalEnded",
    type: "event",
  },
] as const;

export const CONTRACT_ADDRESSES: Record<number, { agentNFT?: Address }> = {
  [sepolia.id]: {
    agentNFT: import.meta.env.VITE_AGENT_NFT_ADDRESS_SEPOLIA as Address | undefined,
  },
  [baseSepolia.id]: {
    agentNFT: import.meta.env.VITE_AGENT_NFT_ADDRESS_BASE_SEPOLIA as Address | undefined,
  },
};

export function getContractAddress(chainId: number, contractName: keyof typeof CONTRACT_ADDRESSES[number]): Address | undefined {
  return CONTRACT_ADDRESSES[chainId]?.[contractName];
}

export function isContractDeployed(chainId: number): boolean {
  const addresses = CONTRACT_ADDRESSES[chainId];
  return !!addresses?.agentNFT;
}

export const DEFAULT_MINT_PRICE_ETH = 0.001;
export const DEFAULT_RENTAL_PRICE_PER_DAY_ETH = 0.0001;
