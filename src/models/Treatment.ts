import { Table, Column, DataType, HasMany, ForeignKey, BelongsTo, BelongsToMany } from 'sequelize-typescript';
import Entity from './Entity';
import User from './User';
import Product from './Product';
import TreatmentProducts from './TreatmentProducts';

@Table({
    freezeTableName: true,
})
export default class Treatment extends Entity {
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare name: string;

    @ForeignKey(() => User)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare userId: string;
    
    @BelongsTo(() => User)
    declare user: User;

    @BelongsToMany(() => Product, () => TreatmentProducts)
    declare products: Product[];

    @HasMany(() => TreatmentProducts)
    declare treatmentProducts: TreatmentProducts[];

    
}