import { getUncachableStripeClient } from '../server/stripeClient';

async function seedStripeProducts() {
  console.log('[Stripe Seed] Starting product creation...');
  
  try {
    const stripe = await getUncachableStripeClient();
    
    // Check if products already exist
    const existingProducts = await stripe.products.search({
      query: "name:'NeuroNet'"
    });
    
    if (existingProducts.data.length > 0) {
      console.log('[Stripe Seed] Products already exist, skipping...');
      return;
    }
    
    // Create Agent Rental Product
    console.log('[Stripe Seed] Creating Agent Rental product...');
    const rentalProduct = await stripe.products.create({
      name: 'NeuroNet Agent Rental',
      description: 'Rent AI trading agents by the day with yield sharing',
      metadata: {
        category: 'agent_rental',
        platform: 'neuronet_governor',
      },
    });
    
    // Create rental prices (different tiers based on agent type)
    await stripe.prices.create({
      product: rentalProduct.id,
      unit_amount: 500, // $5/day for basic agents
      currency: 'usd',
      nickname: 'basic_daily',
      metadata: { tier: 'basic' },
    });
    
    await stripe.prices.create({
      product: rentalProduct.id,
      unit_amount: 2500, // $25/day for pro agents
      currency: 'usd',
      nickname: 'pro_daily',
      metadata: { tier: 'pro' },
    });
    
    await stripe.prices.create({
      product: rentalProduct.id,
      unit_amount: 10000, // $100/day for elite agents
      currency: 'usd',
      nickname: 'elite_daily',
      metadata: { tier: 'elite' },
    });
    
    console.log(`[Stripe Seed] Created rental product: ${rentalProduct.id}`);
    
    // Create NFT Minting Product
    console.log('[Stripe Seed] Creating NFT Minting product...');
    const nftProduct = await stripe.products.create({
      name: 'NeuroNet Agent NFT Mint',
      description: 'Mint your AI trading agent as an NFT on Ethereum or Solana',
      metadata: {
        category: 'nft_mint',
        platform: 'neuronet_governor',
      },
    });
    
    // Create minting prices
    await stripe.prices.create({
      product: nftProduct.id,
      unit_amount: 500, // $5 base minting fee
      currency: 'usd',
      nickname: 'base_mint',
      metadata: { tier: 'base' },
    });
    
    await stripe.prices.create({
      product: nftProduct.id,
      unit_amount: 2500, // $25 premium minting (includes enhanced metadata)
      currency: 'usd',
      nickname: 'premium_mint',
      metadata: { tier: 'premium' },
    });
    
    console.log(`[Stripe Seed] Created NFT product: ${nftProduct.id}`);
    
    // Create Template Purchase Product
    console.log('[Stripe Seed] Creating Template Purchase product...');
    const templateProduct = await stripe.products.create({
      name: 'NeuroNet Agent Template',
      description: 'Purchase AI trading agent templates for permanent ownership',
      metadata: {
        category: 'template_purchase',
        platform: 'neuronet_governor',
      },
    });
    
    // Template prices will be created dynamically based on template pricing
    await stripe.prices.create({
      product: templateProduct.id,
      unit_amount: 9900, // $99 starter template
      currency: 'usd',
      nickname: 'starter_template',
      metadata: { tier: 'starter' },
    });
    
    await stripe.prices.create({
      product: templateProduct.id,
      unit_amount: 29900, // $299 pro template  
      currency: 'usd',
      nickname: 'pro_template',
      metadata: { tier: 'pro' },
    });
    
    await stripe.prices.create({
      product: templateProduct.id,
      unit_amount: 99900, // $999 elite template
      currency: 'usd',
      nickname: 'elite_template',
      metadata: { tier: 'elite' },
    });
    
    console.log(`[Stripe Seed] Created template product: ${templateProduct.id}`);
    
    console.log('[Stripe Seed] All products created successfully!');
    console.log('[Stripe Seed] Summary:');
    console.log(`  - Rental Product: ${rentalProduct.id}`);
    console.log(`  - NFT Product: ${nftProduct.id}`);
    console.log(`  - Template Product: ${templateProduct.id}`);
    
  } catch (error) {
    console.error('[Stripe Seed] Failed to create products:', error);
    throw error;
  }
}

// Run if called directly
seedStripeProducts()
  .then(() => {
    console.log('[Stripe Seed] Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Stripe Seed] Error:', error);
    process.exit(1);
  });
