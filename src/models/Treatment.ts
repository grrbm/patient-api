import { Table, Column, DataType, HasMany, ForeignKey, BelongsTo, BelongsToMany } from 'sequelize-typescript';
import Entity from './Entity';
import User from './User';
import Clinic from './Clinic';
import Product from './Product';
import TreatmentProducts from './TreatmentProducts';
import Questionnaire from './Questionnaire';

@Table({
    freezeTableName: true,
})
export default class Treatment extends Entity {
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare name: string;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    declare treatmentLogo: string;

    @ForeignKey(() => User)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare userId: string;
    
    @BelongsTo(() => User)
    declare user: User;

    @ForeignKey(() => Clinic)
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    declare clinicId: string;
    
    @BelongsTo(() => Clinic)
    declare clinic: Clinic;

    @BelongsToMany(() => Product, () => TreatmentProducts)
    declare products: Product[];

    @HasMany(() => TreatmentProducts)
    declare treatmentProducts: TreatmentProducts[];

    @HasMany(() => Questionnaire)
    declare questionnaires: Questionnaire[];
}