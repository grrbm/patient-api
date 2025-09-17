import User from '../models/User';
import Treatment from '../models/Treatment';
import Order, { OrderStatus, BillingPlan } from '../models/Order';
import StripeService from './stripe';

interface SubscribeTreatmentResult {
    success: boolean;
    message: string;
    data?: {
        paymentUrl: string;
        orderId: string;
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
        billingPlan: BillingPlan = BillingPlan.MONTHLY
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

            // Get treatment and validate
            const treatment = await Treatment.findByPk(treatmentId);
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

            // Create Stripe checkout session
            const checkoutSession = await this.stripeService.checkoutSub({
                line_items: [{
                    price: treatment.stripePriceId,
                    quantity: 1
                }],
                stripeCustomerId: stripeCustomerId,
                metadata: {
                    userId: userId,
                    orderId: order.id,
                    treatmentId: treatmentId
                }
            });

            return {
                success: true,
                message: "Subscription checkout session created successfully",
                data: {
                    paymentUrl: checkoutSession.url!,
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
}

export default PaymentService;
export { SubscribeTreatmentResult };