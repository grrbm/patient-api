import User from '../models/User';
import Treatment from '../models/Treatment';
import Clinic from '../models/Clinic';
import Order, { OrderStatus, BillingPlan } from '../models/Order';
import OrderItem from '../models/OrderItem';
import Product from '../models/Product';
import TreatmentProducts from '../models/TreatmentProducts';
import StripeService from './stripe';

interface SubscribeTreatmentResult {
    success: boolean;
    message: string;
    data?: {
        clientSecret: string;
        subscriptionId: string;
        orderId: string;
    };
    error?: string;
}

interface SubscribeClinicResult {
    success: boolean;
    message: string;
    data?: {
        paymentUrl: string;
    };
    error?: string;
}

class PaymentService {
    private stripeService: StripeService;

    constructor() {
        this.stripeService = new StripeService();
    }

    async subscribeTreatment(
        treatmentId: string,
        userId: string,
        billingPlan: BillingPlan = BillingPlan.MONTHLY,
        stripePriceId?: string
    ): Promise<SubscribeTreatmentResult> {
        try {
            // Get user and validate
            const user = await User.findByPk(userId);
            if (!user) {
                return {
                    success: false,
                    message: "User not found",
                    error: "User with the provided ID does not exist"
                };
            }

            // Get treatment with products and validate
            const treatment = await Treatment.findByPk(treatmentId, {
                include: [
                    {
                        model: TreatmentProducts,
                        as: 'treatmentProducts',
                        include: [
                            {
                                model: Product,
                                as: 'product'
                            }
                        ]
                    }
                ]
            });
            if (!treatment) {
                return {
                    success: false,
                    message: "Treatment not found",
                    error: "Treatment with the provided ID does not exist"
                };
            }

            // Validate treatment has Stripe data
            if (!treatment.stripeProductId || !treatment.stripePriceId) {
                return {
                    success: false,
                    message: "Treatment not configured for subscriptions",
                    error: "Treatment does not have Stripe product or price configured"
                };
            }

            // Ensure user has a Stripe customer ID
            let stripeCustomerId = user.stripeCustomerId;
            if (!stripeCustomerId) {
                const stripeCustomer = await this.stripeService.createCustomer(
                    user.email,
                    `${user.firstName} ${user.lastName}`
                );
                stripeCustomerId = stripeCustomer.id;

                // Save Stripe customer ID to user
                await user.update({ stripeCustomerId });
            }

            // Calculate order amount
            const totalAmount = treatment.price;

            // Create order
            const order = await Order.create({
                orderNumber: Order.generateOrderNumber(),
                userId: userId,
                treatmentId: treatmentId,
                status: OrderStatus.PENDING,
                billingPlan: billingPlan,
                subtotalAmount: totalAmount,
                totalAmount: totalAmount
            });

            // Create order items from treatment products
            if (treatment.treatmentProducts && treatment.treatmentProducts.length > 0) {
                const orderItems = [];
                for (const treatmentProduct of treatment.treatmentProducts) {
                    const product = treatmentProduct.product;
                    const orderItem = await OrderItem.create({
                        orderId: order.id,
                        productId: product.id,
                        quantity: 1, // Default quantity for subscription
                        unitPrice: product.price || 0,
                        totalPrice: product.price || 0,
                        pharmacyProductId: product.pharmacyProductId,
                        dosage: treatmentProduct.dosage || product.dosage || "Use as directed"
                    });
                    orderItems.push(orderItem);
                }
                console.log(`✅ Created ${orderItems.length} order items for treatment subscription`);
            }

            // Create Stripe subscription with payment intent
            const subscription = await this.stripeService.createSubscriptionWithPaymentIntent({
                customerId: stripeCustomerId,
                priceId: stripePriceId || treatment.stripePriceId, // Use provided stripePriceId or fallback to treatment
                metadata: {
                    userId: userId,
                    orderId: order.id,
                    treatmentId: treatmentId
                }
            });

            console.log('📋 Subscription created:', JSON.stringify(subscription, null, 2));

            // Extract client secret from the subscription's payment intent
            const paymentIntent = (subscription as any).latest_invoice?.payment_intent;
            console.log('📋 Latest invoice:', (subscription as any).latest_invoice);
            console.log('📋 Payment intent:', paymentIntent);
            
            if (!paymentIntent || !paymentIntent.client_secret) {
                console.error('❌ No payment intent or client secret found');
                console.error('❌ Subscription status:', subscription.status);
                console.error('❌ Latest invoice status:', (subscription as any).latest_invoice?.status);
                throw new Error('Failed to create payment intent for subscription');
            }

            return {
                success: true,
                message: "Subscription with payment intent created successfully",
                data: {
                    clientSecret: paymentIntent.client_secret,
                    subscriptionId: subscription.id,
                    orderId: order.id
                }
            };

        } catch (error) {
            console.error('Error creating subscription:', error);
            return {
                success: false,
                message: "Failed to create subscription",
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    async subscribeClinic(
        clinicId: string,
        userId: string
    ): Promise<SubscribeClinicResult> {
        try {
            // Get user and validate
            const user = await User.findByPk(userId);
            if (!user) {
                return {
                    success: false,
                    message: "User not found",
                    error: "User with the provided ID does not exist"
                };
            }

            // Get clinic and validate
            const clinic = await Clinic.findByPk(clinicId);
            if (!clinic) {
                return {
                    success: false,
                    message: "Clinic not found",
                    error: "Clinic with the provided ID does not exist"
                };
            }

            if(user.clinicId !=clinicId){
                return {
                    success: false,
                    message: "Forbidden",
                    error: "Forbidden"
                };
            }

            // Ensure user has a Stripe customer ID
            let stripeCustomerId = user.stripeCustomerId;
            if (!stripeCustomerId) {
                const stripeCustomer = await this.stripeService.createCustomer(
                    user.email,
                    `${user.firstName} ${user.lastName}`
                );
                stripeCustomerId = stripeCustomer.id;

                // Save Stripe customer ID to user
                await user.update({ stripeCustomerId });
            }

            // Get Stripe subscription product and price from environment
            const stripeProductId = process.env.STRIPE_SUBSCRIPTION_PRODUCT;
            const stripePriceId = process.env.STRIPE_SUBSCRIPTION_PRICE;

            if (!stripeProductId || !stripePriceId) {
                return {
                    success: false,
                    message: "Subscription not configured",
                    error: "STRIPE_SUBSCRIPTION_PRODUCT or STRIPE_SUBSCRIPTION_PRICE environment variables not set"
                };
            }

            // Create Stripe checkout session
            const checkoutSession = await this.stripeService.checkoutSub({
                line_items: [{
                    price: stripePriceId,
                    quantity: 1
                }],
                stripeCustomerId: stripeCustomerId,
                metadata: {
                    userId: userId,
                    clinicId: clinicId,
                }
            });

            return {
                success: true,
                message: "Clinic subscription checkout session created successfully",
                data: {
                    paymentUrl: checkoutSession.url!
                }
            };

        } catch (error) {
            console.error('Error creating clinic subscription:', error);
            return {
                success: false,
                message: "Failed to create clinic subscription",
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
}

export default PaymentService;
export { SubscribeTreatmentResult, SubscribeClinicResult };