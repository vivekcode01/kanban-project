const { DataTypes } = require("sequelize");
const sequelize = require("./index");
const Column = require("./Column");

const Card = sequelize.define("Card", {
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, defaultValue: "" },
  position: { type: DataTypes.INTEGER, allowNull: false },
});

Column.hasMany(Card, { onDelete: "CASCADE" });
Card.belongsTo(Column);

module.exports = Card;
