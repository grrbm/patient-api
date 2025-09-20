import Stripe from 'stripe';
import { stripe } from './config';

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000"



interface CheckoutSubParams {
  line_items: Stripe.Checkout.SessionCreateParams.LineItem[];
  stripeCustomerId: string;
  metadata: {
    userId: string;
    orderId?: string;
    clinicId?: string;
    treatmentId?: string;
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

  async getPaymentIntent(paymentIntentId: string) {
    return stripe.paymentIntents.retrieve(
      paymentIntentId,
      { expand: ["customer", "invoice"] }
    );
  }

  async getInvoice(invoiceId: string) {
    return stripe.invoices.retrieve(invoiceId, {
      expand: ["subscription"]
    });
  }

  async getSubscription(subscriptionId: string) {
    return stripe.subscriptions.retrieve(subscriptionId);
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

  async createSubscriptionWithPaymentIntent({
    customerId,
    priceId,
    metadata
  }: {
    customerId: string;
    priceId: string;
    metadata?: Record<string, string>;
  }) {
    // Create subscription with payment behavior to create payment intent
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice'],
      metadata: metadata || {}
    });

    // Get the latest invoice
    const invoice = subscription.latest_invoice as any;
    
    // Create a payment intent for the invoice if it doesn't exist
    if (invoice && !invoice.payment_intent) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: invoice.amount_due,
        currency: invoice.currency,
        customer: customerId,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          ...metadata,
          invoice_id: invoice.id,
          subscription_id: subscription.id
        }
      });
      
      console.log('💳 Created payment intent:', {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        status: paymentIntent.status
      });
      
      // Return subscription with the payment intent attached
      return {
        ...subscription,
        latest_invoice: {
          ...invoice,
          payment_intent: paymentIntent
        }
      };
    }

    return subscription;
  }

  // Product management methods
  async createProduct(params: Stripe.ProductCreateParams) {
    return stripe.products.create(params);
  }

  async getProduct(productId: string) {
    return stripe.products.retrieve(productId);
  }

  async updateProduct(productId: string, params: Stripe.ProductUpdateParams) {
    return stripe.products.update(productId, params);
  }

  // Price management methods
  async createPrice(params: Stripe.PriceCreateParams) {
    return stripe.prices.create(params);
  }

  async getPrice(priceId: string) {
    return stripe.prices.retrieve(priceId);
  }

  async updatePrice(priceId: string, params: Stripe.PriceUpdateParams) {
    return stripe.prices.update(priceId, params);
  }

  async deprecatePrice(priceId: string) {
    return stripe.prices.update(priceId, { active: false });
  }

}

export default StripeService;
export { CheckoutSubParams };