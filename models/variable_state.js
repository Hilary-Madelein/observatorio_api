'use strict';

module.exports = (sequelize, DataTypes) => {
    const VariableState = sequelize.define('variable_state', {
        id_station: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        key: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        last_value: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        }
    }, {
        freezeTableName: true,
        underscored: true,
        timestamps: true,
        createdAt: false,
        updatedAt: 'updated_at'
    });

    VariableState.associate = function (models) {
        VariableState.belongsTo(models.station, {
            foreignKey: 'id_station',
            as: 'station'
        });
    };

    return VariableState;
};
