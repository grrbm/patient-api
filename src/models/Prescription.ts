import { Table, Column, DataType, ForeignKey, HasMany, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import User1 from './User';
import Product from './Product';

@Table({
    freezeTableName: true,
})
export default class Prescription extends Entity {
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare name: string;

    @Column({
        type: DataType.DATE,
        allowNull: false,
    })
    declare expiresAt: Date;

    @Column({
        type: DataType.DATE,
        allowNull: false,
    })
    declare writtenAt: Date;

    @ForeignKey(() => User1)
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare patientId: string;

    @BelongsTo(() => User1)
    declare patient: User1;

    @ForeignKey(() => User1)
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare doctorId: string;

    @BelongsTo(() => User1)
    declare doctor: User1;

    @ForeignKey(() => Product)
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare productId: string;

    @BelongsTo(() => Product)
    declare product: Product;

    @HasMany(() => Product)
    declare products: Product[];
}