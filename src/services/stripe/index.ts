import Stripe from 'stripe';
import { stripe } from './config';

const FRONTEND_URL = process.env.FRONTEND_URL || "localhost:3000"



interface CheckoutSubParams {
  line_items: Stripe.Checkout.SessionCreateParams.LineItem[];
  stripeCustomerId: string;
  metadata:{
    userId: string;
    orderId: string;
    treatmentId: string;
  }
}


class StripeService {
  async checkoutSub({
    line_items,
    stripeCustomerId,
    metadata,
  }: CheckoutSubParams) {
    return stripe.checkout.sessions.create({
      line_items,
      customer: stripeCustomerId,
      mode: "subscription",
      cancel_url: `${FRONTEND_URL}/cancel`, // Assuming cart route
      success_url:
        `${FRONTEND_URL}/success`,
      metadata: metadata,
      saved_payment_method_options: {
        payment_method_save: "enabled",
      },
    });
  }

  async createCustomer(email: string, name?: string) {

    return stripe.customers.create({
      email,
      name
    });

  }

  async getCustomer(customerId: string) {

    return stripe.customers.retrieve(customerId);
  }

  async createProductWithPrice(
    name: string,
    unitAmount: number,
    currency: string = 'usd',
    interval: 'month' | 'year' = 'month',
    description?: string
  ) {
    // Create the product first
    const product = await stripe.products.create({
      name,
      description,
      type: 'service'
    });

    // Create the price associated with the product
    const price = await stripe.prices.create({
      unit_amount: Math.round(unitAmount * 100), // Convert to cents
      currency,
      recurring: {
        interval
      },
      product: product.id
    });

    return {
      product,
      price
    };
  }

  async createPaymentIntent(
    amount: number,
    currency: string = 'usd',
    customerId?: string
  ) {

    return stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
    });
  }

  // Helper method to construct webhook event
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event | null {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      console.error('Error constructing webhook event:', error);
      return null;
    }
  }
}

export default StripeService;
export { CheckoutSubParams };