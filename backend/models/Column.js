const { DataTypes } = require("sequelize");
const sequelize = require("./index");
const Board = require("./Board");

const Column = sequelize.define("Column", {
  title: { type: DataTypes.STRING, allowNull: false },
  position: { type: DataTypes.INTEGER, allowNull: false },
});

Board.hasMany(Column, { onDelete: "CASCADE" });
Column.belongsTo(Board);

module.exports = Column;
