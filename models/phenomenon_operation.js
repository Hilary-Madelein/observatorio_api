'use strict';

module.exports = (sequelize, DataTypes) => {
    const phenomenon_operation = sequelize.define('phenomenon_operation', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
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
        underscored: true
    });

    phenomenon_operation.associate = function (models) {
        phenomenon_operation.belongsTo(models.phenomenon_type, {
            foreignKey: 'id_phenomenon_type'
        });
        phenomenon_operation.belongsTo(models.type_operation, {
            foreignKey: 'id_type_operation'
        });
        phenomenon_operation.hasMany(models.measurement, {
            foreignKey: 'id_measurement',
            as: 'phenomenon_operation'
        });
    };

    return phenomenon_operation;
};
