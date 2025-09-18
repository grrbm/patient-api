import { Table, Column, DataType, ForeignKey, BelongsTo, HasMany, HasOne } from 'sequelize-typescript';
import Entity from './Entity';
import User from './User';
import Treatment from './Treatment';
import Questionnaire from './Questionnaire';
import OrderItem from './OrderItem';
import Payment from './Payment';
import ShippingAddress from './ShippingAddress';
import ShippingOrder from './ShippingOrder';

export enum OrderStatus {
  PENDING = 'pending',
  PAYMENT_PROCESSING = 'payment_processing',
  PAID = 'paid',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}


export enum BillingPlan {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  BIANNUAL = 'biannual'
}

@Table({
  freezeTableName: true,
  tableName: 'Order',
})
export default class Order extends Entity {
  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare orderNumber: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @ForeignKey(() => Treatment)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare treatmentId: string;

  @BelongsTo(() => Treatment)
  declare treatment: Treatment;

  @ForeignKey(() => Questionnaire)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare questionnaireId?: string;

  @BelongsTo(() => Questionnaire)
  declare questionnaire?: Questionnaire;

  @Column({
    type: DataType.ENUM(...Object.values(OrderStatus)),
    allowNull: false,
    defaultValue: OrderStatus.PENDING,
  })
  declare status: OrderStatus;

  @Column({
    type: DataType.ENUM(...Object.values(BillingPlan)),
    allowNull: false,
  })
  declare billingPlan: BillingPlan;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare subtotalAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  declare discountAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  declare taxAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  declare shippingAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare totalAmount: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare notes?: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare questionnaireAnswers?: Record<string, any>;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare shippedAt?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare deliveredAt?: Date;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  declare stripeSubscriptionId?: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare paidAt?: Date;



  @HasMany(() => OrderItem)
  declare orderItems: OrderItem[];

  @HasOne(() => Payment)
  declare payment: Payment;

  @HasOne(() => ShippingAddress)
  declare shippingAddress: ShippingAddress;

  @HasMany(() => ShippingOrder)
  declare shippingOrders: ShippingOrder[];

  // Static method to generate order number
  public static generateOrderNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  // Calculate total amount from items
  public calculateTotal(): number {
    const subtotal = this.subtotalAmount || 0;
    const discount = this.discountAmount || 0;
    const tax = this.taxAmount || 0;
    const shipping = this.shippingAmount || 0;

    return subtotal - discount + tax + shipping;
  }

  // Update order status
  public async updateStatus(status: OrderStatus): Promise<void> {
    this.status = status;

    if (status === OrderStatus.SHIPPED) {
      this.shippedAt = new Date();
    } else if (status === OrderStatus.DELIVERED) {
      this.deliveredAt = new Date();
    }

    await this.save();
  }

  public async markOrderAsPaid(): Promise<void> {
    this.status = OrderStatus.PAID;
    this.paidAt = new Date()
    await this.save();
  }

  public async updateOrderProcessing(stripeSubscriptionId:string): Promise<void> {
    this.stripeSubscriptionId = stripeSubscriptionId;
    this.status = OrderStatus.PAYMENT_PROCESSING;
    await this.save();
  }
}