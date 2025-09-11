const express = require("express");
const cors = require("cors");
const { Sequelize, DataTypes } = require("sequelize");
const { v4: uuidv4 } = require('uuid'); // Import uuid to generate IDs

const app = express();
const port = 8080;

app.use(cors());
app.use(express.json());

// --- Sequelize Database Setup ---

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

// --- Model Definitions ---
const Board = sequelize.define("Board", {
  id: { type: DataTypes.STRING, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
});

const Column = sequelize.define("Column", {
  id: { type: DataTypes.STRING, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  position: { type: DataTypes.INTEGER },
});

const Card = sequelize.define("Card", {
  id: { type: DataTypes.STRING, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  position: { type: DataTypes.INTEGER },
});

// --- Associations ---
Board.hasMany(Column, { onDelete: 'CASCADE' });
Column.belongsTo(Board);

Column.hasMany(Card, { onDelete: 'CASCADE' });
Card.belongsTo(Column);


// --- API Routes with Error Handling ---

// Get a specific board with all its columns and cards
app.get("/api/board/:id", async (req, res) => {
  try {
    const board = await Board.findByPk(req.params.id, {
      include: [
        {
          model: Column,
          include: [Card], // Include cards nested within columns
        },
      ],
      order: [
          [Column, 'position', 'ASC'],
          [Column, Card, 'position', 'ASC']
      ]
    });

    if (!board) return res.status(200).json({ board: null });

    const columns = board.Columns || [];
    const cards = columns.flatMap((col) => col.Cards || []);
    
    res.json({ board, columns, cards });
  } catch (error) {
    console.error("GET /api/board/:id Error:", error);
    res.status(500).json({ error: "Failed to fetch board data" });
  }
});

// Create a board
app.post("/api/board", async (req, res) => {
  try {
    const { title } = req.body;
    const boardId = req.body.id || uuidv4();
    const board = await Board.create({ id: boardId, title });
    res.status(201).json(board);
  } catch (error) {
    console.error("POST /api/board Error:", error);
    res.status(500).json({ error: "Failed to create board" });
  }
});

// Create a column
app.post("/api/column", async (req, res) => {
  try {
    const col = await Column.create({
      id: uuidv4(),
      title: req.body.title,
      position: req.body.position,
      BoardId: req.body.boardId,
    });
    res.status(201).json(col);
  } catch (error) {
    console.error("POST /api/column Error:", error);
    res.status(500).json({ error: "Failed to create column" });
  }
});

// Update a column (rename)
app.put("/api/column/:id", async (req, res) => {
  try {
    await Column.update(
        { title: req.body.title },
        { where: { id: req.params.id } }
    );
    res.sendStatus(200);
  } catch (error) {
    console.error("PUT /api/column/:id Error:", error);
    res.status(500).json({ error: "Failed to update column" });
  }
});

// Delete a column
app.delete("/api/column/:id", async (req, res) => {
  try {
    await Column.destroy({ where: { id: req.params.id } });
    res.sendStatus(204);
  } catch (error) {
    console.error("DELETE /api/column/:id Error:", error);
    res.status(500).json({ error: "Failed to delete column" });
  }
});


// Create a card
app.post("/api/card", async (req, res) => {
  try {
    const card = await Card.create({
      id: uuidv4(),
      title: req.body.title,
      description: req.body.description || "",
      position: req.body.position,
      ColumnId: req.body.columnId,
    });
    res.status(201).json(card);
  } catch (error) {
    console.error("POST /api/card Error:", error);
    res.status(500).json({ error: "Failed to create card" });
  }
});

// Update a card (for drag-and-drop, title change, etc.)
app.put("/api/card/:id", async (req, res) => {
  try {
    const { title, description, position, columnId } = req.body;
    await Card.update(
      { title, description, position, ColumnId: columnId },
      { where: { id: req.params.id } }
    );
    res.sendStatus(200);
  } catch (error) {
    console.error("PUT /api/card/:id Error:", error);
    res.status(500).json({ error: "Failed to update card" });
  }
});

// Delete a card
app.delete("/api/card/:id", async (req, res) => {
  try {
    await Card.destroy({ where: { id: req.params.id } });
    res.sendStatus(204);
  } catch (error) {
    console.error("DELETE /api/card/:id Error:", error);
    res.status(500).json({ error: "Failed to delete card" });
  }
});


// --- Start Server ---

app.listen(port, async () => {
  await sequelize.sync(); 
  const board = await Board.findByPk("board-1");
  if (!board) {
    await Board.create({ id: "board-1", title: "My Kanban Board" });
    console.log("Default board created.");
  }
  console.log(`Backend running on http://localhost:${port}`);
});

