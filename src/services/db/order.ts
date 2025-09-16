import Order from "../../models/Order";

export const getOrder = async (oderId: string) => {
    return await Order.findOne({
        where: {
            id: oderId,
        },
    });
}