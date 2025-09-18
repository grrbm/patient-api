import Stripe from 'stripe';
import Payment from '../../models/Payment';
import Order, { OrderStatus } from '../../models/Order';
import StripeService from '.';

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
        const { orderId } = session.metadata;
        const { subscription } = session;

        console.log(" subscription ", subscription)


        if (orderId && subscription) {
            const order = await Order.findByPk(orderId);
            if (order) {
                await order.updateOrderProcessing(subscription as string);
                console.log('✅ Subscription order updated to payment processing:', order.orderNumber);
            }
        }
    }
};

export const handleInvoicePaid = async (invoice: Stripe.Invoice): Promise<void> => {
    console.log('Invoice paid:', invoice.id);

    const subItem = invoice?.lines?.data[0]

    const subscriptionId = subItem?.parent?.subscription_item_details?.subscription

    if (subscriptionId) {
        const order = await Order.findOne({
            where: {
                stripeSubscriptionId: subscriptionId
            }
        });
        if (order) {
            await order.markOrderAsPaid();
            console.log('✅ Subscription order updated to paid:', order.orderNumber);
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

        default:
            console.log(`🔍 Unhandled event type ${event.type}`);
    }
};