import Stripe from 'stripe';
import { stripe } from './config';

const FRONTEND_URL = process.env.FRONTEND_URL || "localhost:3000"



interface CheckoutSubParams {
  line_items: Stripe.Checkout.SessionCreateParams.LineItem[];
  stripeCustomerId: string;
  metadata: {
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