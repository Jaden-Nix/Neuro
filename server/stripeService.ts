import { getUncachableStripeClient } from './stripeClient';

export class StripeService {
  async createPaymentIntent(amount: number, currency: string = 'usd', metadata: Record<string, string> = {}) {
    const stripe = await getUncachableStripeClient();
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
}

export const stripeService = new StripeService();
