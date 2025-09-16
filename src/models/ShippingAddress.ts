import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import Order from './Order';

@Table({
  freezeTableName: true,
  tableName: 'ShippingAddress',
})
export default class ShippingAddress extends Entity {
  @ForeignKey(() => Order)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    unique: true,
  })
  declare orderId: string;

  @BelongsTo(() => Order)
  declare order: Order;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare address: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare apartment?: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare city: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare state: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare zipCode: string;

  @Column({
    type: DataType.STRING(2),
    allowNull: false,
    defaultValue: 'US',
  })
  declare country: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare trackingNumber?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare carrier?: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare shippedAt?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare estimatedDeliveryDate?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare deliveredAt?: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare deliveryNotes?: string;

  // Format full address as string
  public getFormattedAddress(): string {
    let formatted = this.address;
    
    if (this.apartment) {
      formatted += `, ${this.apartment}`;
    }
    
    formatted += `\n${this.city}, ${this.state} ${this.zipCode}`;
    
    if (this.country && this.country !== 'US') {
      formatted += `\n${this.country}`;
    }
    
    return formatted;
  }

  // Update shipping tracking information
  public async updateTracking(trackingNumber: string, carrier: string): Promise<void> {
    this.trackingNumber = trackingNumber;
    this.carrier = carrier;
    this.shippedAt = new Date();
    await this.save();
  }

  // Mark as delivered
  public async markAsDelivered(deliveryNotes?: string): Promise<void> {
    this.deliveredAt = new Date();
    if (deliveryNotes) {
      this.deliveryNotes = deliveryNotes;
    }
    await this.save();
  }

  // Validate US address format
  public validateUSAddress(): boolean {
    if (this.country !== 'US') return true;
    
    // Basic US zip code validation (5 digits or 5+4 format)
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!zipRegex.test(this.zipCode)) return false;
    
    // Basic state validation (2 letter code)
    const stateRegex = /^[A-Z]{2}$/;
    if (!stateRegex.test(this.state)) return false;
    
    return true;
  }
}