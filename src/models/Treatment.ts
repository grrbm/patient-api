import { Table, Column, DataType, HasMany, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import Prescription from './Prescription';
import User1 from './User';

@Table({
    freezeTableName: true,
})
export default class Treatment extends Entity {
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare name: string;

    @ForeignKey(() => User1)
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare userId: string;
    
    @BelongsTo(() => User1)
    declare user: User1;

    @ForeignKey(() => Prescription)
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare prescriptionId: string;

    @BelongsTo(() => Prescription)
    declare prescription: Prescription;

    @HasMany(() => Prescription)
    declare prescriptions: Prescription[];

    
}