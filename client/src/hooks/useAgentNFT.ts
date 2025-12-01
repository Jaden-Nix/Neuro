import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, useChainId, usePublicClient } from "wagmi";
import { parseEther, formatEther, type Address, decodeEventLog, keccak256, toHex } from "viem";
import { AGENT_NFT_ABI, getContractAddress, isContractDeployed, DEFAULT_MINT_PRICE_ETH } from "@/lib/contracts";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";

export function useAgentNFT() {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();
  const publicClient = usePublicClient();
  const [isDeployed, setIsDeployed] = useState(false);
  const [mintingTemplateId, setMintingTemplateId] = useState<string>("");

  const contractAddress = getContractAddress(chainId, "agentNFT");

  useEffect(() => {
    setIsDeployed(isContractDeployed(chainId));
  }, [chainId]);

  const { data: mintPrice, isLoading: isPriceLoading } = useReadContract({
    address: contractAddress,
    abi: AGENT_NFT_ABI,
    functionName: "mintPrice",
    query: {
      enabled: !!contractAddress && isDeployed,
    },
  });

  const { data: totalMinted, isLoading: isTotalLoading } = useReadContract({
    address: contractAddress,
    abi: AGENT_NFT_ABI,
    functionName: "totalMinted",
    query: {
      enabled: !!contractAddress && isDeployed,
    },
  });

  const { data: userTokens, isLoading: isTokensLoading, refetch: refetchUserTokens } = useReadContract({
    address: contractAddress,
    abi: AGENT_NFT_ABI,
    functionName: "getTokensByOwner",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!contractAddress && !!userAddress && isDeployed,
    },
  });

  const { 
    writeContract: writeMint, 
    data: mintHash, 
    isPending: isMintPending,
    error: mintError,
    reset: resetMint
  } = useWriteContract();

  const { 
    writeContract: writeRent, 
    data: rentHash, 
    isPending: isRentPending,
    error: rentError,
    reset: resetRent
  } = useWriteContract();

  const { 
    writeContract: writeEndRental, 
    data: endRentalHash, 
    isPending: isEndRentalPending,
    error: endRentalError,
    reset: resetEndRental
  } = useWriteContract();

  const { isLoading: isMintConfirming, isSuccess: isMintConfirmed } = useWaitForTransactionReceipt({
    hash: mintHash,
  });

  const { isLoading: isRentConfirming, isSuccess: isRentConfirmed } = useWaitForTransactionReceipt({
    hash: rentHash,
  });

  const { isLoading: isEndRentalConfirming, isSuccess: isEndRentalConfirmed } = useWaitForTransactionReceipt({
    hash: endRentalHash,
  });

  const mintAgent = async (templateId: string, agentType: string, tokenURI: string) => {
    if (!contractAddress) {
      toast({
        title: "Contract Not Deployed",
        description: "The AgentNFT contract is not deployed on this network yet.",
        variant: "destructive",
      });
      return;
    }

    try {
      const priceToUse = mintPrice ?? parseEther(DEFAULT_MINT_PRICE_ETH.toString());
      
      // Store templateId for use in confirmation handler
      setMintingTemplateId(templateId);
      
      writeMint({
        address: contractAddress,
        abi: AGENT_NFT_ABI,
        functionName: "mintAgent",
        args: [templateId, agentType, tokenURI],
        value: priceToUse,
      });
    } catch (error) {
      console.error("Mint error:", error);
      toast({
        title: "Mint Failed",
        description: error instanceof Error ? error.message : "Failed to mint agent NFT",
        variant: "destructive",
      });
    }
  };

  const rentAgent = async (tokenId: bigint, durationDays: number, rentalPrice: bigint) => {
    if (!contractAddress) {
      toast({
        title: "Contract Not Deployed",
        description: "The AgentNFT contract is not deployed on this network yet.",
        variant: "destructive",
      });
      return;
    }

    try {
      writeRent({
        address: contractAddress,
        abi: AGENT_NFT_ABI,
        functionName: "rentAgent",
        args: [tokenId, BigInt(durationDays)],
        value: rentalPrice,
      });
    } catch (error) {
      console.error("Rent error:", error);
      toast({
        title: "Rental Failed",
        description: error instanceof Error ? error.message : "Failed to rent agent",
        variant: "destructive",
      });
    }
  };

  const endRental = async (tokenId: bigint) => {
    if (!contractAddress) {
      toast({
        title: "Contract Not Deployed",
        description: "The AgentNFT contract is not deployed on this network yet.",
        variant: "destructive",
      });
      return;
    }

    try {
      writeEndRental({
        address: contractAddress,
        abi: AGENT_NFT_ABI,
        functionName: "endRental",
        args: [tokenId],
      });
    } catch (error) {
      console.error("End rental error:", error);
      toast({
        title: "End Rental Failed",
        description: error instanceof Error ? error.message : "Failed to end rental",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (isMintConfirmed && mintHash && userAddress && contractAddress) {
      // Extract token ID from transaction receipt
      (async () => {
        try {
          const receipt = await publicClient?.getTransactionReceipt({ hash: mintHash });
          
          if (!receipt) {
            toast({
              title: "Warning",
              description: "Transaction confirmed but receipt not found",
              variant: "destructive",
            });
            return;
          }

          // Decode Transfer event to get token ID
          const TRANSFER_EVENT_SIG = keccak256(toHex("Transfer(address,address,uint256)"));
          let tokenId = "";
          
          for (const log of receipt.logs) {
            if (log.topics[0] === TRANSFER_EVENT_SIG && log.address.toLowerCase() === contractAddress.toLowerCase()) {
              try {
                const decoded = decodeEventLog({
                  abi: AGENT_NFT_ABI,
                  data: log.data,
                  topics: log.topics,
                });
                if (decoded.eventName === "Transfer" && decoded.args) {
                  const args = decoded.args as any;
                  tokenId = args.tokenId?.toString() || "";
                  break;
                }
              } catch {
                continue;
              }
            }
          }

          if (!tokenId) {
            throw new Error("Could not extract token ID from transaction");
          }

          // Record the NFT on backend with real blockchain data
          const chainName = chainId === 11155111 ? "ethereum" : "solana";
          await apiRequest("/api/marketplace/nfts/mint", {
            method: "POST",
            body: JSON.stringify({
              templateId: mintingTemplateId,
              ownerAddress: userAddress,
              chain: chainName,
              tokenId,
              contractAddress,
              txHash: mintHash,
            }),
          });

          toast({
            title: "Agent Minted Successfully!",
            description: `Transaction confirmed. Token ID: ${tokenId}`,
          });
          
          refetchUserTokens();
          resetMint();
          setMintingTemplateId("");
        } catch (error) {
          console.error("Error recording minted NFT:", error);
          toast({
            title: "Partial Success",
            description: "NFT minted on-chain but failed to record in database. " + (error instanceof Error ? error.message : ""),
            variant: "destructive",
          });
          resetMint();
          setMintingTemplateId("");
        }
      })();
    }
  }, [isMintConfirmed, mintHash, userAddress, contractAddress, publicClient, chainId]);

  useEffect(() => {
    if (isRentConfirmed) {
      toast({
        title: "Rental Started Successfully!",
        description: "The agent rental has been activated on-chain.",
      });
      resetRent();
    }
  }, [isRentConfirmed]);

  useEffect(() => {
    if (isEndRentalConfirmed) {
      toast({
        title: "Rental Ended Successfully!",
        description: "The agent rental has been terminated on-chain.",
      });
      resetEndRental();
    }
  }, [isEndRentalConfirmed]);

  useEffect(() => {
    if (mintError) {
      toast({
        title: "Mint Transaction Failed",
        description: mintError.message,
        variant: "destructive",
      });
    }
  }, [mintError]);

  useEffect(() => {
    if (rentError) {
      toast({
        title: "Rent Transaction Failed",
        description: rentError.message,
        variant: "destructive",
      });
    }
  }, [rentError]);

  useEffect(() => {
    if (endRentalError) {
      toast({
        title: "End Rental Transaction Failed",
        description: endRentalError.message,
        variant: "destructive",
      });
    }
  }, [endRentalError]);

  return {
    contractAddress,
    isDeployed,
    mintPrice: mintPrice as bigint | undefined,
    totalMinted: totalMinted as bigint | undefined,
    userTokens: userTokens as bigint[] | undefined,
    isPriceLoading,
    isTotalLoading,
    isTokensLoading,
    mintAgent,
    rentAgent,
    endRental,
    isMintPending,
    isMintConfirming,
    isMintConfirmed,
    mintHash,
    isRentPending,
    isRentConfirming,
    isRentConfirmed,
    rentHash,
    isEndRentalPending,
    isEndRentalConfirming,
    isEndRentalConfirmed,
    endRentalHash,
    refetchUserTokens,
    chainId,
  };
}

export function useAgentMetadata(tokenId: bigint | undefined) {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId, "agentNFT");

  const { data, isLoading, error } = useReadContract({
    address: contractAddress,
    abi: AGENT_NFT_ABI,
    functionName: "getAgentMetadata",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: !!contractAddress && tokenId !== undefined,
    },
  });

  return {
    metadata: data as {
      templateId: string;
      agentType: string;
      mintedAt: bigint;
      originalMinter: Address;
      isRented: boolean;
      currentRenter: Address;
      rentalExpiry: bigint;
    } | undefined,
    isLoading,
    error,
  };
}

export function useIsRentalActive(tokenId: bigint | undefined) {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId, "agentNFT");

  const { data, isLoading, error } = useReadContract({
    address: contractAddress,
    abi: AGENT_NFT_ABI,
    functionName: "isRentalActive",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: !!contractAddress && tokenId !== undefined,
    },
  });

  return {
    isActive: data as boolean | undefined,
    isLoading,
    error,
  };
}

export function useIsAvailableForRent(tokenId: bigint | undefined) {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId, "agentNFT");

  const { data, isLoading, error, refetch } = useReadContract({
    address: contractAddress,
    abi: AGENT_NFT_ABI,
    functionName: "availableForRent",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: !!contractAddress && tokenId !== undefined,
    },
  });

  return {
    isAvailable: data as boolean | undefined,
    isLoading,
    error,
    refetch,
  };
}

export function useRentalPrice(tokenId: bigint | undefined, durationDays: number) {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId, "agentNFT");

  const { data, isLoading, error, refetch } = useReadContract({
    address: contractAddress,
    abi: AGENT_NFT_ABI,
    functionName: "getRentalPrice",
    args: tokenId !== undefined ? [tokenId, BigInt(durationDays)] : undefined,
    query: {
      enabled: !!contractAddress && tokenId !== undefined && durationDays > 0,
    },
  });

  return {
    rentalPrice: data as bigint | undefined,
    rentalPriceEth: data ? formatEther(data as bigint) : undefined,
    isLoading,
    error,
    refetch,
  };
}
