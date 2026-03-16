'use strict';

module.exports = (sequelize, DataTypes) => {
    const role = sequelize.define('role', {
        external_id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            unique: true
        },
        name: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        status: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        freezeTableName: true,
        underscored: true
    });

    role.associate = function (models) {
        role.belongsToMany(models.entity, {
            through: models.entity_role,
            as: 'entities',
            foreignKey: 'role_id'
        });
    };

    return role;
};
