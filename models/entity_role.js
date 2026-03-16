'use strict';

module.exports = (sequelize, DataTypes) => {
    const entity_role = sequelize.define('entity_role', {
        status: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        external_id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            unique: true
        }
    }, {
        freezeTableName: true,
        underscored: true,
        timestamps: false
    });

    entity_role.associate = function (models) {
        entity_role.belongsTo(models.entity, { foreignKey: 'entity_id', as: 'entity' });
        entity_role.belongsTo(models.role, { foreignKey: 'role_id', as: 'role' });
    };

    return entity_role;
};
