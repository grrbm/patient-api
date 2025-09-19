import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import Order from './Order';


export enum OrderShippingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

@Table({
  freezeTableName: true,
  tableName: 'ShippingOrder',
})
export default class ShippingOrder extends Entity {
  @ForeignKey(() => Order)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare orderId: string;

  @BelongsTo(() => Order)
  declare order: Order;

  @Column({
    type: DataType.ENUM(...Object.values(OrderShippingStatus)),
    allowNull: false,
    defaultValue: OrderShippingStatus.PENDING,
  })
  declare status: OrderShippingStatus;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare address: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare pharmacyOrderId?: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare deliveredAt?: Date;

  // Update shipping status
  public async updateStatus(status: OrderShippingStatus): Promise<void> {
    this.status = status;

    if (status === OrderShippingStatus.DELIVERED) {
      this.deliveredAt = new Date();
    }

    await this.save();
  }
}