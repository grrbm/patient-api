import { Table, Column, DataType, HasMany } from 'sequelize-typescript';
import Entity from './Entity';
import User from './User';

@Table({
    freezeTableName: true,
})
export default class Clinic extends Entity {
    @Column({
        type: DataType.STRING,
        allowNull: false,
        unique: true,
    })
    declare slug: string;

    @Column({
        type: DataType.TEXT,
        allowNull: false,
    })
    declare logo: string;

    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare name: string;

    @HasMany(() => User)
    declare users: User[];
}