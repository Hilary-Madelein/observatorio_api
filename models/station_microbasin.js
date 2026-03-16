'use strict';

module.exports = (sequelize, DataTypes) => {
    const station_microbasin = sequelize.define('station_microbasin', {
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
        underscored: true,
        timestamps: true
    });

    station_microbasin.associate = function (models) {
        station_microbasin.belongsTo(models.station, { foreignKey: 'id_station', as: 'station' });
        station_microbasin.belongsTo(models.microbasin, { foreignKey: 'id_microbasin', as: 'microbasin' });
    };

    return station_microbasin;
};
