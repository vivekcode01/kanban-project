// require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { Sequelize, DataTypes, Op } = require("sequelize"); // Import Op for operators
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const port = process.env.PORT || 8080; // Use environment port or default to 8080

// --- Create HTTP Server and Integrate Socket.IO ---
const server = http.createServer(app);
// backend/server.js

const io = new Server(server, {
  cors: {
    origin: "https://kanbantodo1.netlify.app", // THIS IS THE FIX
    methods: ["GET", "POST"]
  }
});

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
  },
  logging: false // Optional: disable logging for cleaner console output
});

// --- Model Definitions ---
const Board = sequelize.define("Board", { id: { type: DataTypes.STRING, primaryKey: true }, title: { type: DataTypes.STRING, allowNull: false } });
const Column = sequelize.define("Column", { id: { type: DataTypes.STRING, primaryKey: true }, title: { type: DataTypes.STRING, allowNull: false }, position: { type: DataTypes.INTEGER } });
const Card = sequelize.define("Card", { id: { type: DataTypes.STRING, primaryKey: true }, title: { type: DataTypes.STRING, allowNull: false }, description: { type: DataTypes.TEXT }, position: { type: DataTypes.INTEGER } });

// --- Associations ---
Board.hasMany(Column, { onDelete: 'CASCADE', foreignKey: 'BoardId' });
Column.belongsTo(Board, { foreignKey: 'BoardId' });
Column.hasMany(Card, { onDelete: 'CASCADE', foreignKey: 'ColumnId' });
Card.belongsTo(Column, { foreignKey: 'ColumnId' });

// --- Middleware to broadcast updates ---
const broadcastUpdate = (req, res, next) => {
  // This function will be called after the route handler successfully finishes
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('Change detected, emitting board.updated');
      io.emit("board.updated"); // Correct event name with a dot
    }
  });
  next();
};

// --- API Routes ---

// Health Check Endpoint
app.get("/", (req, res) => { res.status(200).send("Server is live and healthy"); });

// Get a specific board
app.get("/api/board/:id", async (req, res) => {
  try {
    const board = await Board.findByPk(req.params.id, {
      include: [{ model: Column, include: [Card] }],
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
    res.status(500).json({ error: "Failed to fetch board data." });
  }
});

// Create a board (if it doesn't exist)
app.post('/api/board', broadcastUpdate, async (req, res) => {
    try {
        const [board, created] = await Board.findOrCreate({
            where: { id: req.body.id },
            defaults: { title: req.body.title || 'My Kanban' }
        });
        res.status(created ? 201 : 200).json(board);
    } catch (error) {
        console.error("POST /api/board Error:", error);
        res.status(500).json({ error: "Failed to create board." });
    }
});


// Create a column
app.post("/api/column", broadcastUpdate, async (req, res) => {
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
    res.status(500).json({ error: "Failed to create column." });
  }
});

// Update a column (for renaming) - NEW
app.put("/api/column/:id", broadcastUpdate, async (req, res) => {
    try {
        await Column.update(
            { title: req.body.title },
            { where: { id: req.params.id } }
        );
        res.sendStatus(200);
    } catch (error) {
        console.error("PUT /api/column/:id Error:", error);
        res.status(500).json({ error: "Failed to update column." });
    }
});

// Delete a column - NEW
app.delete("/api/column/:id", broadcastUpdate, async (req, res) => {
    try {
        await Column.destroy({ where: { id: req.params.id } });
        res.sendStatus(204); // No Content
    } catch (error) {
        console.error("DELETE /api/column/:id Error:", error);
        res.status(500).json({ error: "Failed to delete column." });
    }
});

// Create a card
app.post("/api/card", broadcastUpdate, async (req, res) => {
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
    res.status(500).json({ error: "Failed to create card." });
  }
});

// Update a card's text content - NEW
app.put("/api/card/:id", broadcastUpdate, async (req, res) => {
  try {
    const { title, description } = req.body;
    await Card.update(
      { title, description },
      { where: { id: req.params.id } }
    );
    res.sendStatus(200);
  } catch (error) {
    console.error("PUT /api/card/:id Error:", error);
    res.status(500).json({ error: "Failed to update card." });
  }
});

// Move a card (for drag-and-drop) - NEW & IMPROVED
app.put("/api/card/:id/move", broadcastUpdate, async (req, res) => {
    const { newColumnId, newPosition } = req.body;
    const cardId = req.params.id;

    try {
        await sequelize.transaction(async (t) => {
            const card = await Card.findByPk(cardId, { transaction: t });
            if (!card) {
                return res.status(404).json({ error: 'Card not found' });
            }
            const oldColumnId = card.ColumnId;
            const oldPosition = card.position;

            // Scenario 1: Moving within the same column
            if (oldColumnId === newColumnId) {
                if (newPosition > oldPosition) {
                    // Moving down: shift cards between old and new pos up
                    await Card.update({ position: Sequelize.literal('position - 1') }, {
                        where: { ColumnId: oldColumnId, position: { [Op.gt]: oldPosition, [Op.lte]: newPosition } },
                        transaction: t
                    });
                } else {
                    // Moving up: shift cards between new and old pos down
                    await Card.update({ position: Sequelize.literal('position + 1') }, {
                        where: { ColumnId: oldColumnId, position: { [Op.gte]: newPosition, [Op.lt]: oldPosition } },
                        transaction: t
                    });
                }
            }
            // Scenario 2: Moving to a different column
            else {
                // Shift cards down in the old column to fill the gap
                await Card.update({ position: Sequelize.literal('position - 1') }, {
                    where: { ColumnId: oldColumnId, position: { [Op.gt]: oldPosition } },
                    transaction: t
                });
                // Shift cards down in the new column to make space
                await Card.update({ position: Sequelize.literal('position + 1') }, {
                    where: { ColumnId: newColumnId, position: { [Op.gte]: newPosition } },
                    transaction: t
                });
            }

            // Finally, update the moved card's position and column
            await card.update({ position: newPosition, ColumnId: newColumnId }, { transaction: t });
        });

        res.sendStatus(200);
    } catch (error) {
        console.error("PUT /api/card/:id/move Error:", error);
        res.status(500).json({ error: "Failed to move card." });
    }
});


// Delete a card - NEW
app.delete("/api/card/:id", broadcastUpdate, async (req, res) => {
    try {
        // We need to re-order the remaining cards in the column
        await sequelize.transaction(async (t) => {
            const card = await Card.findByPk(req.params.id, { transaction: t });
            if (card) {
                const { ColumnId, position } = card;
                await Card.destroy({ where: { id: req.params.id }, transaction: t });
                // Shift cards up to fill the gap
                await Card.update({ position: Sequelize.literal('position - 1') }, {
                    where: { ColumnId: ColumnId, position: { [Op.gt]: position } },
                    transaction: t
                });
            }
        });
        res.sendStatus(204); // No Content
    } catch (error) {
        console.error("DELETE /api/card/:id Error:", error);
        res.status(500).json({ error: "Failed to delete card." });
    }
});


// --- Socket.IO Connection Logic ---
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// --- Start Server ---
server.listen(port, async () => {
  try {
    await sequelize.sync();
    // Ensure the default board exists
    await Board.findOrCreate({
        where: { id: "board-1" },
        defaults: { title: "My Kanban Board" }
    });
    console.log("Default board ensured.");
    console.log(`Backend running on http://localhost:${port}`);
  } catch (error) {
    console.error("Unable to sync database:", error);
  }
});