'use strict';

module.exports = (sequelize, DataTypes) => {
    const type_operation = sequelize.define('type_operation', {
        operation: {
            type: DataTypes.ENUM('PROMEDIO', 'MAX', 'MIN', 'SUMA'),
            allowNull: false
        },
        external_id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            unique: true
        },
        status: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        freezeTableName: true,
        timestamps: false,
        underscored: true
    });

    type_operation.associate = function (models) {
        type_operation.hasMany(models.daily_measurement, {
            foreignKey: 'id_type_operation',
            as: 'daily_measurements'
        });
        type_operation.belongsToMany(models.phenomenon_type, {
            through: 'phenomenon_operation',
            as: 'phenomena',
            foreignKey: 'id_type_operation'
        });
    };

    // Inicializa los valores por defecto si no existen
    type_operation.initializeDefaults = async function () {
        const defaultOperations = ['PROMEDIO', 'MAX', 'MIN', 'SUMA'];

        for (const op of defaultOperations) {
            const exists = await type_operation.findOne({ where: { operation: op } });
            if (!exists) {
                await type_operation.create({ operation: op });
            }
        }
    };

    return type_operation;
};
