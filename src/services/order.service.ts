import { listOrdersByClinic } from "./db/order";
import { getUser } from "./db/user";
import { OrderService as PharmacyOrderService } from "./pharmacy";
import Order from '../models/Order';
import User from '../models/User';
import OrderItem from '../models/OrderItem';
import Product from '../models/Product';
import { OrderStatus } from '../models/Order';


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

class OrderService {

    // Prepare pharmacy order data from database
    private pharmacyOrderService = new PharmacyOrderService();

    constructor() {
        this.pharmacyOrderService = new PharmacyOrderService();

    }


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
    async approveOrder(orderId: string, userId: string) {
        try {
            // Get order with all related data
            const order = await Order.findOne({
                where: { id: orderId },
                include: [
                    {
                        model: User,
                        as: 'user',
                        attributes: ['id', 'firstName', 'lastName', 'email', 'pharmacyPatientId', 'clinicId']
                    },
                    {
                        model: OrderItem,
                        as: 'orderItems',
                        include: [
                            {
                                model: Product,
                                as: 'product',
                                attributes: ['id', 'name', 'pharmacyProductId', 'dosage']
                            }
                        ]
                    }
                ]
            });

            if (!order) {
                return {
                    success: false,
                    message: "Order not found",
                    error: "Order with the provided ID does not exist"
                };
            }

            // Check if order already has a pharmacy order ID
            if (order.pharmacyOrderId) {
                return {
                    success: false,
                    message: "Order already approved",
                    error: "This order has already been sent to the pharmacy"
                };
            }

            // Get approving doctor and validate they are a doctor in the same clinic
            const doctor = await getUser(userId);
            if (!doctor) {
                return {
                    success: false,
                    message: "Doctor not found",
                    error: "Doctor with the provided ID does not exist"
                };
            }

            if (doctor.role !== 'doctor') {
                return {
                    success: false,
                    message: "Access denied",
                    error: "Only doctors can approve orders"
                };
            }

            // TODO validate that doctor is in the same clinic as order


            // Check if order is already processed
            if (order.status !== OrderStatus.PAID) {
                return {
                    success: false,
                    message: "Order cannot be approved",
                    error: `Order status is ${order.status}. Only paid orders can be approved.`
                };
            }



            // Validate doctor has pharmacy physician ID
            if (!doctor.pharmacyPhysicianId) {
                return {
                    success: false,
                    message: "Doctor not configured for pharmacy",
                    error: "Doctor must have a valid pharmacy physician ID to approve orders"
                };
            }

            // Validate patient has pharmacy patient ID
            if (!order.user.pharmacyPatientId) {
                return {
                    success: false,
                    message: "Patient not configured for pharmacy",
                    error: "Patient must have a valid pharmacy patient ID to process orders"
                };
            }



            // Map order items to pharmacy products
            const products = order.orderItems.map(item => ({
                sku: parseInt(item.product.pharmacyProductId || '0'), // Use pharmacy product ID or default
                quantity: item.quantity,
                refills: 2, // Default refills - could be made configurable
                days_supply: 30, // Default days supply - could be made configurable
                sig: item.dosage || item.product.dosage || "Use as directed",
                medical_necessity: item.notes || "Prescribed treatment as part of patient care plan."
            }));

            // Create pharmacy order
            const pharmacyResult = await this.pharmacyOrderService.createOrder({
                patient_id: parseInt(order.user.pharmacyPatientId),
                physician_id: parseInt(doctor.pharmacyPhysicianId),
                ship_to_clinic: 0, // Ship to patient
                service_type: "two_day",
                signature_required: 1,
                memo: order.notes || "Order approved by doctor",
                external_id: order.orderNumber,
                test_order: process.env.NODE_ENV === 'production' ? 0 : 1,
                products: products
            });

            if (!pharmacyResult.success) {
                return {
                    success: false,
                    message: "Failed to create pharmacy order",
                    error: pharmacyResult.error || "Unknown pharmacy error"
                };
            }

            // Update order with pharmacy order ID and status
            await order.update({
                pharmacyOrderId: pharmacyResult.data?.number?.toString() || pharmacyResult.data?.id?.toString(),
                status: OrderStatus.PROCESSING
            });

            return {
                success: true,
                message: "Order successfully approved and sent to pharmacy",
            };

        } catch (error) {
            console.error('Error approving order:', error);
            return {
                success: false,
                message: "Failed to approve order",
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
}



export default OrderService;
export { ListOrdersByClinicResult, PaginationParams };