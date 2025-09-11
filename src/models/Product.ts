import { Table, Column, DataType } from 'sequelize-typescript';
import Entity from './Entity';

@Table({
    freezeTableName: true,
})
export default class Product extends Entity {
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare name: string;

    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare description: string;

    @Column({
        type: DataType.FLOAT,
        allowNull: false,
    })
    declare price: number;

    @Column({
        type: DataType.ARRAY(DataType.STRING),
        allowNull: false,
    })
    declare activeIngredients: string[];

    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare dosage: string;

    @Column({
        type: DataType.TEXT,
        allowNull: false,
    })
    declare imageUrl: string;
}
