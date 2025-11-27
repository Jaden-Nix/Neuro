import { getUncachableStripeClient } from './stripeClient';

const PLATFORM_FEE_PERCENT = 15;

export class StripeService {
  async createPaymentIntent(amount: number, currency: string = 'usd', metadata: Record<string, string> = {}) {
    const stripe = await getUncachableStripeClient();
    return await stripe.paymentIntents.create({
      amount,
      currency,
      metadata,
    });
  }

  async createMarketplacePaymentIntent(
    amount: number, 
    currency: string = 'usd', 
    metadata: Record<string, string> = {},
    sellerStripeAccountId?: string
  ) {
    const stripe = await getUncachableStripeClient();
    
    if (sellerStripeAccountId) {
      const platformFee = Math.round(amount * (PLATFORM_FEE_PERCENT / 100));
      
      return await stripe.paymentIntents.create({
        amount,
        currency,
        metadata,
        application_fee_amount: platformFee,
        transfer_data: {
          destination: sellerStripeAccountId,
        },
      });
    }
    
    return await stripe.paymentIntents.create({
      amount,
      currency,
      metadata,
    });
  }

  async retrievePaymentIntent(intentId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.paymentIntents.retrieve(intentId);
  }

  async createConnectAccount(email: string, metadata: Record<string, string> = {}) {
    const stripe = await getUncachableStripeClient();
    return await stripe.accounts.create({
      type: 'express',
      email,
      metadata,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
  }

  async createConnectAccountLink(accountId: string, returnUrl: string, refreshUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
  }

  async getConnectAccount(accountId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.accounts.retrieve(accountId);
  }

  async createConnectLoginLink(accountId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.accounts.createLoginLink(accountId);
  }

  async getAccountBalance(accountId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.balance.retrieve({ stripeAccount: accountId });
  }

  async createPayout(accountId: string, amount: number, currency: string = 'usd') {
    const stripe = await getUncachableStripeClient();
    return await stripe.payouts.create(
      { amount, currency },
      { stripeAccount: accountId }
    );
  }

  async createPrice(productId: string, unitAmount: number, currency: string = 'usd') {
    const stripe = await getUncachableStripeClient();
    return await stripe.prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency,
    });
  }

  async createProduct(name: string, metadata: Record<string, string> = {}) {
    const stripe = await getUncachableStripeClient();
    return await stripe.products.create({
      name,
      metadata,
    });
  }

  getPlatformFeePercent() {
    return PLATFORM_FEE_PERCENT;
  }
}

export const stripeService = new StripeService();
