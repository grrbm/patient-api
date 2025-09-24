import Stripe from 'stripe';
import Payment from '../../models/Payment';
import Order, { OrderStatus } from '../../models/Order';
import StripeService from '.';
import Subscription from '../../models/Subscription';
import Clinic, { PaymentStatus } from '../../models/Clinic';
import BrandSubscription, { BrandSubscriptionStatus } from '../../models/BrandSubscription';
import User from '../../models/User';
import BrandSubscriptionPlans from '../../models/BrandSubscriptionPlans';

export const handlePaymentIntentSucceeded = async (paymentIntent: Stripe.PaymentIntent): Promise<void> => {
    console.log('💳 Payment succeeded:', paymentIntent.id);

    // Find payment record
    const payment = await Payment.findOne({
        where: { stripePaymentIntentId: paymentIntent.id },
        include: [{ model: Order, as: 'order' }]
    });

    if (payment) {
        // Update payment status
        await payment.updateFromStripeEvent({ object: paymentIntent });

        // Update order status
        await payment.order.updateStatus(OrderStatus.PAID);

        console.log('✅ Order updated to paid status:', payment.order.orderNumber);
    } else {
        console.error('❌ Payment record not found for payment intent:', paymentIntent.id);
    }
};

export const handlePaymentIntentFailed = async (failedPayment: Stripe.PaymentIntent): Promise<void> => {
    console.log('❌ Payment failed:', failedPayment.id);

    // Find payment record
    const failedPaymentRecord = await Payment.findOne({
        where: { stripePaymentIntentId: failedPayment.id },
        include: [{ model: Order, as: 'order' }]
    });

    if (failedPaymentRecord) {
        // Update payment status
        await failedPaymentRecord.updateFromStripeEvent({ object: failedPayment });

        // Update order status
        await failedPaymentRecord.order.updateStatus(OrderStatus.CANCELLED);

        console.log('❌ Order updated to cancelled status:', failedPaymentRecord.order.orderNumber);
    }
};

export const handlePaymentIntentCanceled = async (cancelledPayment: Stripe.PaymentIntent): Promise<void> => {
    console.log('🚫 Payment cancelled:', cancelledPayment.id);

    // Find payment record
    const cancelledPaymentRecord = await Payment.findOne({
        where: { stripePaymentIntentId: cancelledPayment.id },
        include: [{ model: Order, as: 'order' }]
    });

    if (cancelledPaymentRecord) {
        // Update payment status
        await cancelledPaymentRecord.updateFromStripeEvent({ object: cancelledPayment });

        // Update order status
        await cancelledPaymentRecord.order.updateStatus(OrderStatus.CANCELLED);

        console.log('🚫 Order updated to cancelled status:', cancelledPaymentRecord.order.orderNumber);
    }
};

export const handleChargeDisputeCreated = async (dispute: Stripe.Dispute): Promise<void> => {
    console.log('⚠️ Dispute created:', dispute.id);

    // Find payment by charge ID
    const disputedPayment = await Payment.findOne({
        where: { stripeChargeId: dispute.charge },
        include: [{ model: Order, as: 'order' }]
    });

    if (disputedPayment) {
        // Update order status to refunded (dispute handling)
        await disputedPayment.order.updateStatus(OrderStatus.REFUNDED);
        console.log('⚠️ Order marked as disputed:', disputedPayment.order.orderNumber);
    }
};

export const handleCheckoutSessionCompleted = async (session: Stripe.Checkout.Session): Promise<void> => {
    console.log('🛒 Checkout session completed:', session.id);

    // Handle subscription checkout completion
    if (session.mode === 'subscription' && session.metadata) {
        const { orderId, clinicId, userId, planType } = session.metadata;
        const { subscription } = session;

        console.log(" subscription ", subscription)

        let createSub = false

        // Handle brand subscription
        if (userId && planType) {
            const user = await User.findByPk(userId);
            if (user && user.role === 'brand') {
                console.log("Creating brand subscription for user:", userId);
                
                const selectedPlan = await BrandSubscriptionPlans.getPlanByType(planType as any);
                
                if (selectedPlan) {
                    const brandSub = await BrandSubscription.create({
                        userId: userId,
                        planType: planType as any,
                        status: BrandSubscriptionStatus.PROCESSING,
                        stripeSubscriptionId: subscription as string,
                        stripeCustomerId: session.customer as string,
                        stripePriceId: selectedPlan.stripePriceId,
                        monthlyPrice: selectedPlan.monthlyPrice
                    });
                    console.log('✅ Brand subscription created:', brandSub.id);
                }
                return; // Exit early for brand subscriptions
            }
        }

        // Handle existing clinic/order subscriptions
        if (orderId) {
            const order = await Order.findByPk(orderId);
            if (order) {
                createSub = true
                console.log("Order found")
            }
        } else if (clinicId) {
            const clinic = await Clinic.findByPk(clinicId);
            if (clinic) {
                createSub = true
                console.log("Clinic found")
            }
        }

        if (createSub) {
            console.log("Creating sub")
            const sub = await Subscription.create({
                ...(orderId && { orderId: orderId }),
                ...(clinicId && { clinicId: clinicId }),
                stripeSubscriptionId: subscription as string
            })
            console.log('✅ Subscription created:', sub.id);
        }
    }
};

export const handleInvoicePaid = async (invoice: Stripe.Invoice): Promise<void> => {
    console.log('Invoice paid:', invoice.id);

    const subItem = invoice?.lines?.data[0]
    const subscriptionId = (subItem?.subscription || subItem?.parent?.subscription_item_details?.subscription) as string

    if (subscriptionId && typeof subscriptionId === 'string') {
        // Check for brand subscription first
        const brandSub = await BrandSubscription.findOne({
            where: {
                stripeSubscriptionId: subscriptionId
            }
        });

        if (brandSub) {
            // Handle brand subscription payment
            const stripeService = new StripeService();
            try {
                const stripeSubscription = await stripeService.getSubscription(subscriptionId);
                
                await brandSub.activate({
                    subscriptionId: subscriptionId,
                    customerId: stripeSubscription.customer as string,
                    currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
                    currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000)
                });
                
                console.log('✅ Brand subscription activated:', brandSub.id);
            } catch (error) {
                console.error('Error activating brand subscription:', error);
                // Fallback activation without period data
                await brandSub.updateProcessing(subscriptionId);
            }
            return; // Exit early for brand subscriptions
        }

        // Handle existing clinic/order subscriptions
        const sub = await Subscription.findOne({
            where: {
                stripeSubscriptionId: subscriptionId
            }
        });
        
        if (sub) {
            await sub.markSubAsPaid();
            console.log('✅ Subscription updated to paid:', sub.id);

            if (sub.orderId) {
                const order = await Order.findByPk(sub.orderId);
                if (order) {
                    await order.update({
                        status: PaymentStatus.PAID
                    })
                    // TODO: send a new order to pharmacy
                    console.log("Sending new order ",  order.shippingOrders.length)
                }
            }
            if (sub.clinicId) {
                const clinic = await Clinic.findByPk(sub.clinicId);
                if (clinic) {
                    await clinic.update({
                        active: true,
                        status: PaymentStatus.PAID
                    })
                }
            }
        }
    }
};

export const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice): Promise<void> => {
    console.log('❌ Invoice payment failed:', invoice.id);

    const subItem = invoice?.lines?.data[0]
    const subscriptionId = (subItem?.subscription || subItem?.parent?.subscription_item_details?.subscription) as string

    const stripeService = new StripeService();

    if (subscriptionId && typeof subscriptionId === 'string') {
        // Check for brand subscription first
        const brandSub = await BrandSubscription.findOne({
            where: {
                stripeSubscriptionId: subscriptionId
            }
        });

        if (brandSub) {
            if (brandSub.status === BrandSubscriptionStatus.CANCELLED) {
                console.warn('⚠️ Brand subscription has been cancelled', subscriptionId);
                return;
            }

            try {
                const subscriptionResponse = await stripeService.getSubscription(subscriptionId);
                const validUntil = new Date((subscriptionResponse as any).current_period_end * 1000);
                
                await brandSub.markPaymentDue(validUntil);
                console.log('⚠️ Brand subscription marked as payment due until:', validUntil.toISOString());
            } catch (error) {
                console.error('Error handling brand subscription payment failure:', error);
                await brandSub.markPastDue();
            }
            return; // Exit early for brand subscriptions
        }

        // Handle existing clinic/order subscriptions
        const sub = await Subscription.findOne({
            where: {
                stripeSubscriptionId: subscriptionId
            }
        });

        if (sub) {
            if (sub.orderId) {
                const order = await Order.findByPk(sub.orderId);
                if (order) {
                    await order.update({
                        status: OrderStatus.PAYMENT_DUE
                    })
                }
            }
            if (sub.clinicId) {
                const clinic = await Clinic.findByPk(sub.clinicId);
                if (clinic) {
                    await clinic.update({
                        status: PaymentStatus.PAYMENT_DUE
                    })
                }
            }

            if (sub.status == PaymentStatus.CANCELLED) {
                console.warn('⚠️ Subscription has been cancelled', subscriptionId);
                return
            }

            const subscriptionResponse = await stripeService.getSubscription(subscriptionId as string);
            const currentPeriodEnd = subscriptionResponse.items.data[0]

            if (currentPeriodEnd?.current_period_end) {
                const validUntil = new Date(currentPeriodEnd?.current_period_end * 1000);

                await sub.markSubAsPaymentDue(validUntil);
                console.log('⚠️ Subscription order marked as payment due until:', validUntil.toISOString());
            }
        } else {
            console.warn('⚠️ No subscription found for failed payment:', subscriptionId);
        }
    } else {
        console.warn('⚠️ No subscription ID found in failed invoice:', invoice.id);
    }
};

export const handleSubscriptionDeleted = async (subscription: Stripe.Subscription): Promise<void> => {
    console.log('Subscription Cancel:', subscription.id);

    const { id: subscriptionId } = subscription;

    // Check for brand subscription first
    const brandSub = await BrandSubscription.findOne({
        where: {
            stripeSubscriptionId: subscriptionId
        }
    });

    if (brandSub) {
        await brandSub.cancel();
        console.log('✅ Brand subscription canceled:', brandSub.id);
        return; // Exit early for brand subscriptions
    }

    // Handle existing clinic/order subscriptions
    const sub = await Subscription.findOne({
        where: {
            stripeSubscriptionId: subscriptionId
        }
    });
    
    if (sub) {
        await sub.markSubAsCanceled();
        console.log('✅ Subscription updated to canceled:', sub.id);

        if (sub.orderId) {
            const order = await Order.findByPk(sub.orderId);
            if (order) {
                await order.update({
                    status: OrderStatus.CANCELLED
                })
            }
        }

        if (sub.clinicId) {
            const clinic = await Clinic.findByPk(sub.clinicId);
            if (clinic) {
                await clinic.update({
                    active: false,
                    status: PaymentStatus.CANCELLED
                })
            }
        }
    }
};


export const processStripeWebhook = async (event: Stripe.Event): Promise<void> => {
    switch (event.type) {
        case 'payment_intent.succeeded':
            await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
            break;

        case 'payment_intent.payment_failed':
            await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
            break;

        case 'payment_intent.canceled':
            await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
            break;

        case 'charge.dispute.created':
            await handleChargeDisputeCreated(event.data.object as Stripe.Dispute);
            break;

        case 'checkout.session.completed':
            await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
            break;

        case 'invoice.paid':
            await handleInvoicePaid(event.data.object as Stripe.Invoice);
            break;
        case "invoice.payment_failed":
            await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
            break;

        case "customer.subscription.deleted":
            await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
            break;


        default:
            console.log(`🔍 Unhandled event type ${event.type}`);
    }
};