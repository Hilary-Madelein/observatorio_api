'use strict';

module.exports = (sequelize, DataTypes) => {
    const phenomenon_type = sequelize.define('phenomenon_type', {
        name_en: {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: "NO_DATA"
        },
        icon: {
            type: DataTypes.STRING(80),
            defaultValue: "NO_DATA"
        },
        unit_measure: {
            type: DataTypes.STRING(10),
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
        },
        alias: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
            defaultValue: "NO_DATA"
        },
        ttn_keys: {
            type: DataTypes.ARRAY(DataTypes.TEXT),
            defaultValue: [],
            allowNull: true
        }
    }, {
        freezeTableName: true,
        underscored: true,
        indexes: [
            {
                name: 'idx_phenomenon_type_status',
                fields: ['status']
            }
        ]
    });

    phenomenon_type.associate = function (models) {
        phenomenon_type.hasMany(models.daily_measurement, {
            foreignKey: 'id_phenomenon_type',
            as: 'daily_measurements'
        });
        phenomenon_type.belongsToMany(models.station, {
            through: 'station_phenomenon_type',
            as: 'stations',
            foreignKey: 'id_phenomenon_type'
        });
        phenomenon_type.belongsToMany(models.type_operation, {
            through: 'phenomenon_operation',
            as: 'type_operations',
            foreignKey: 'id_phenomenon_type'
        });
        phenomenon_type.belongsTo(models.entity, { foreignKey: 'investigator_id', as: 'investigator' });
    };

    return phenomenon_type;
};
