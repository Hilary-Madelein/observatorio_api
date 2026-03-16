'use strict';

module.exports = (sequelize, DataTypes) => {
    const Station = sequelize.define('station', {
        external_id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            unique: true
        },
        status: {
            type: DataTypes.ENUM('OPERATIVA', 'MANTENIMIENTO', 'NO_OPERATIVA'),
            allowNull: false,
            defaultValue: 'OPERATIVA'
        },
        picture: {
            type: DataTypes.STRING(80),
            defaultValue: "NO_DATA"
        },
        name: {
            type: DataTypes.STRING(30),
            defaultValue: "NO_DATA"
        },
        name_en: {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: "NO_DATA"
        },
        longitude: {
            type: DataTypes.DOUBLE,
            allowNull: false
        },
        latitude: {
            type: DataTypes.DOUBLE,
            allowNull: false
        },
        altitude: {
            type: DataTypes.DOUBLE,
            allowNull: false
        },
        id_device: {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: "NO_DATA"
        },
        app_user: {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: "NO_DATA"
        },
        type: {
            type: DataTypes.ENUM('METEOROLOGICA', 'HIDROLOGICA', 'PLUVIOMETRICA'),
            allowNull: false,
            defaultValue: 'METEOROLOGICA'
        },
        description: {
            type: DataTypes.STRING(500),
            defaultValue: "NO_DATA"
        },
        description_en: {
            type: DataTypes.STRING(500),
            allowNull: false,
            defaultValue: "NO_DATA"
        },
        alias: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: "NO_DATA"
        }
    }, {
        freezeTableName: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['id_device']
            }
        ]
    });
    
    Station.associate = function (models) {
        Station.belongsToMany(models.microbasin, {
            through: 'station_microbasin',
            as: 'microbasins',
            foreignKey: 'id_station'
        });

        Station.hasMany(models.measurement, {
            foreignKey: 'id_station',
            as: 'measurements'
        });

        Station.hasMany(models.daily_measurement, {
            foreignKey: 'id_station',
            as: 'daily_measurements'
        });

        Station.belongsToMany(models.phenomenon_type, {
            through: 'station_phenomenon_type',
            as: 'phenomenon_types',
            foreignKey: 'id_station'
        });
    };

    return Station;
};
