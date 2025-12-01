# Deployment Artifacts

This directory contains deployment artifacts for different networks.

## Files

- `deployment-sepolia.json` - Sepolia testnet deployment
- `deployment-base-sepolia.json` - Base Sepolia testnet deployment

## After Deployment

After running the deployment script, copy the contract addresses to your environment:

### For Sepolia:
```bash
AGENT_NFT_ADDRESS_SEPOLIA=<address>
AGENT_REGISTRY_ADDRESS_SEPOLIA=<address>
MEMORY_VAULT_ADDRESS_SEPOLIA=<address>
```

### For Base Sepolia:
```bash
AGENT_NFT_ADDRESS_BASE_SEPOLIA=<address>
AGENT_REGISTRY_ADDRESS_BASE_SEPOLIA=<address>
MEMORY_VAULT_ADDRESS_BASE_SEPOLIA=<address>
```

### Frontend Environment (Vite):
```bash
VITE_AGENT_NFT_ADDRESS_SEPOLIA=<address>
VITE_AGENT_NFT_ADDRESS_BASE_SEPOLIA=<address>
```

## Deployment Commands

```bash
# Compile contracts
npx tsx scripts/compile.ts

# Deploy to Sepolia
DEPLOYER_PRIVATE_KEY=0x... npx tsx scripts/deploy-viem.ts sepolia

# Deploy to Base Sepolia  
DEPLOYER_PRIVATE_KEY=0x... npx tsx scripts/deploy-viem.ts baseSepolia
```
