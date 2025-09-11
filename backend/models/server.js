const express = require("express");
const cors = require("cors");
const sequelize = require("./models/index");
const Board = require("./models/Board");
const Column = require("./models/Column");
const Card = require("./models/Card");

const app = express();
app.use(cors());
app.use(express.json());

// Sync tables
sequelize.sync().then(() => console.log("✅ DB synced with Supabase"));

// Example route
app.get("/", (req, res) => res.send("Kanban API connected to Supabase"));
