import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import Product from './Product';
import Prescription from './Prescription';

@Table({
    freezeTableName: true,
})
export default class PrescriptionProducts extends Entity {
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare prescriptionId: string;

    @Column({
        type: DataType.INTEGER,
        allowNull: false,
    })
    declare quantity: number;

    @ForeignKey(() => Product)
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare productId: string;

    @BelongsTo(() => Product)
    declare product: Product;

    @BelongsTo(() => Prescription)
    declare prescription: Prescription;
}