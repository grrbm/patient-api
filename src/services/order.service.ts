import { getOrder } from "./db/order";
import { OrderService } from "./pharmacy";

export const approveOrder = async (orderId: string) => {
    const order = getOrder(orderId)
    if (!order) {
        throw Error("Order not found")
    }

    const orderService = new OrderService();

    await orderService.createOrder({
        "patient_id": 1,
        "physician_id": 1,
        "ship_to_clinic": 0,
        "service_type": "two_day",
        "signature_required": 1,
        "memo": "Test memo",
        "external_id": "testing",
        "test_order": 1,
        "products": [
            {
                "sku": 1213,
                "quantity": 30,
                "refills": 2,
                "days_supply": 30,
                "sig": "Use as directed",
                "medical_necessity": "Patient has a history of diabetes and requires treatment to improve quality of life."
            }
        ]
    })
}