'use strict';

module.exports = (sequelize, DataTypes) => {
    const Microbasin = sequelize.define('microbasin', {
        external_id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            unique: true
        },
        status: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
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
            defaultValue: "NO_DATA"
        },
        description: {
            type: DataTypes.STRING(500),
            defaultValue: "NO_DATA"
        },
        description_en: {
            type: DataTypes.STRING(500),
            defaultValue: "NO_DATA"
        },
        coordinate_file: {
            type: DataTypes.STRING(255),
            defaultValue: "default.txt"
        }
    }, {
        freezeTableName: true,
        underscored: true
    });

    Microbasin.associate = function (models) {
        Microbasin.belongsToMany(models.station, {
            through: 'station_microbasin',
            as: 'stations',
            foreignKey: 'id_microbasin'
        });

        Microbasin.belongsTo(models.entity, { 
            foreignKey: 'investigator_id', 
            as: 'investigator' });
    };

    return Microbasin;
};
