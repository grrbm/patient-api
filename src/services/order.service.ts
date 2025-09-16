import { getOrder, listOrdersByClinic } from "./db/order";
import { getUser } from "./db/user";
import { OrderService } from "./pharmacy";


interface ListOrdersByClinicResult {
    success: boolean;
    message: string;
    data?: {
        orders: any[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    };
    error?: string;
}

interface PaginationParams {
    page?: number;
    limit?: number;
}

class OrderServiceClass {
    async listOrdersByClinic(
        clinicId: string,
        userId: string,
        paginationParams: PaginationParams = {}
    ): Promise<ListOrdersByClinicResult> {
        try {
            // Get user and validate they are a doctor
            const user = await getUser(userId);
            if (!user) {
                return {
                    success: false,
                    message: "User not found",
                    error: "User with the provided ID does not exist"
                };
            }

            if (user.role !== 'doctor') {
                return {
                    success: false,
                    message: "Access denied",
                    error: "Only doctors can list clinic orders"
                };
            }

            // Verify the doctor belongs to the clinic
            if (user.clinicId !== clinicId) {
                return {
                    success: false,
                    message: "Forbidden",
                    error: "Doctor does not belong to the specified clinic"
                };
            }

            // Set default pagination values
            const page = Math.max(1, paginationParams.page || 1);
            const limit = Math.min(100, Math.max(1, paginationParams.limit || 10));

            // Get orders by clinic with pagination
            const result = await listOrdersByClinic(clinicId, { page, limit });

            return {
                success: true,
                message: `Successfully retrieved ${result.orders.length} orders`,
                data: {
                    orders: result.orders,
                    pagination: {
                        page,
                        limit,
                        total: result.total,
                        totalPages: result.totalPages
                    }
                }
            };

        } catch (error) {
            console.error('Error listing orders by clinic:', error);
            return {
                success: false,
                message: "Failed to retrieve orders",
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
}

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

export default OrderServiceClass;
export { ListOrdersByClinicResult, PaginationParams };