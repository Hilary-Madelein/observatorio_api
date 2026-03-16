'use strict';

module.exports = (sequelize, DataTypes) => {
    const Quantity = sequelize.define('quantity', {
        external_id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            unique: true
        },
        status: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        quantity: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        }
    }, {
        freezeTableName: true,
        timestamps: false,
        underscored: true
    });

    Quantity.associate = function(models) {
        Quantity.hasMany(models.measurement, {
            foreignKey: 'id_quantity',
            as: 'measurements'
        });
    };

    return Quantity;
};
