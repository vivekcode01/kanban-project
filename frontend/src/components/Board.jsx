import { DragDropContext } from '@hello-pangea/dnd';
import React, { useEffect, useState } from 'react';
import Column from './Column';

import axios from 'axios';

const API_URL = "https://kanban-backend-api-8q9j.onrender.com/api"; // backend base url
const BOARD_ID = "board-1";

export default function Board() {
  const [data, setData] = useState(null);
  const [newColTitle, setNewColTitle] = useState('');

  // Load board
  useEffect(() => {
    async function fetchBoard() {
      try {
        const res = await axios.get(`${API_URL}/board/${BOARD_ID}`);
        if (!res.data.board) {
          // create board if not exists
          await axios.post(`${API_URL}/board`, { id: BOARD_ID, title: "My Kanban" });
          return fetchBoard();
        }
       // PASTE THIS NEW BLOCK IN ITS PLACE

const { columns, cards } = res.data;

// Create a map of all cards for easy lookup
const cardMap = {};
cards.forEach(card => { cardMap[card.id] = card; });

// Create the map of columns, ensuring cards within are sorted
const columnMap = {};
columns.forEach(col => {
  // 1. Find all cards that belong to this column
  const cardsInColumn = cards.filter(card => card.columnId === col.id);
  
  // 2. Sort those cards by their saved position
  cardsInColumn.sort((a, b) => a.position - b.position);

  // 3. Get the final, sorted array of card IDs
  const sortedCardIds = cardsInColumn.map(card => card.id);

  // 4. Add the column to our map with the correctly sorted card IDs
  columnMap[col.id] = { ...col, cardIds: sortedCardIds };
});

setData({
  columns: columnMap,
  columnOrder: columns.map(c => c.id),
  cards: cardMap
});
      } catch (err) {
        console.error(err);
      }
    }
    fetchBoard();
  }, []);

  if (!data) return <p>Loading board...</p>;

  const persist = (next) => setData(next);

  const onDragEnd = async (result) => {
  const { destination, source, draggableId } = result;
  if (!destination) return;

  // If dropped back in same place → ignore
  if (
    destination.droppableId === source.droppableId &&
    destination.index === source.index
  ) {
    return;
  }

  // Create deep copy of state
  const start = data.columns[source.droppableId];
  const finish = data.columns[destination.droppableId];

  if (start === finish) {
    // Reorder inside same column
    const newCardIds = Array.from(start.cardIds);
    newCardIds.splice(source.index, 1);
    newCardIds.splice(destination.index, 0, draggableId);

    const newColumn = { ...start, cardIds: newCardIds };

    const next = {
      ...data,
      columns: { ...data.columns, [newColumn.id]: newColumn },
    };

    persist(next);

    // Update DB positions
    await axios.put(`${API_URL}/card/${draggableId}`, {
      ...data.cards[draggableId],
      position: destination.index,
      columnId: start.id,
    });
  } else {
    // Moving to different column
    const startCardIds = Array.from(start.cardIds);
    startCardIds.splice(source.index, 1);
    const newStart = { ...start, cardIds: startCardIds };

    const finishCardIds = Array.from(finish.cardIds);
    finishCardIds.splice(destination.index, 0, draggableId);
    const newFinish = { ...finish, cardIds: finishCardIds };

    const next = {
      ...data,
      columns: {
        ...data.columns,
        [newStart.id]: newStart,
        [newFinish.id]: newFinish,
      },
      cards: {
        ...data.cards,
        [draggableId]: {
          ...data.cards[draggableId],
          columnId: finish.id,
        },
      },
    };

    persist(next);

    // Update DB
    await axios.put(`${API_URL}/card/${draggableId}`, {
      ...data.cards[draggableId],
      position: destination.index,
      columnId: finish.id,
    });
  }
};


  // Column CRUD
  // Add Column
const addColumn = async (title) => {
  const res = await axios.post(`${API_URL}/column`, {
    title,
    position: data.columnOrder.length,
    boardId: BOARD_ID, // pick actual board
  });

  const col = res.data;
  const next = {
    ...data,
    columns: { ...data.columns, [col.id]: { ...col, cardIds: [] } },
    columnOrder: [...data.columnOrder, col.id],
  };
  persist(next);
};

  // Card CRUD
  // Add Card
const addCard = async (colId, title) => {
  const res = await axios.post(`${API_URL}/card`, {
    title,
    description: "",
    position: data.columns[colId].cardIds.length,
    columnId: colId,
  });

  const card = res.data;
  const next = {
    ...data,
    cards: { ...data.cards, [card.id]: card },
    columns: {
      ...data.columns,
      [colId]: {
        ...data.columns[colId],
        cardIds: [...data.columns[colId].cardIds, card.id],
      },
    },
  };
  persist(next);
};
  // Update card
const updateCard = async (cardId, updates) => {
  const card = { ...data.cards[cardId], ...updates };
  await axios.put(`${API_URL}/card/${cardId}`, card);
  const next = {
    ...data,
    cards: { ...data.cards, [cardId]: card },
  };
  persist(next);
};

// Delete card
const deleteCard = async (cardId) => {
  await axios.delete(`${API_URL}/card/${cardId}`);
  const { columnId } = data.cards[cardId];
  const newCards = { ...data.cards };
  delete newCards[cardId];
  const next = {
    ...data,
    cards: newCards,
    columns: {
      ...data.columns,
      [columnId]: {
        ...data.columns[columnId],
        cardIds: data.columns[columnId].cardIds.filter((id) => id !== cardId),
      },
    },
  };
  persist(next);
};

// Update column
const renameColumn = async (colId, newTitle) => {
  const col = { ...data.columns[colId], title: newTitle };
  await axios.put(`${API_URL}/column/${colId}`, col);
  const next = {
    ...data,
    columns: { ...data.columns, [colId]: col },
  };
  persist(next);
};

// Delete column
const deleteColumn = async (colId) => {
  await axios.delete(`${API_URL}/column/${colId}`);
  const newColumns = { ...data.columns };
  delete newColumns[colId];
  const next = {
    ...data,
    columns: newColumns,
    columnOrder: data.columnOrder.filter((id) => id !== colId),
  };
  persist(next);
};


  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input value={newColTitle} onChange={e => setNewColTitle(e.target.value)} className="input" placeholder="New column title" />
        <button className="btn btn-primary" onClick={() => addColumn(newColTitle)}>Add Column</button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="board-area">
          {data.columnOrder.map(colId => {
            const col = data.columns[colId];
            if (!col) return null;
            const cards = col.cardIds.map(cid => data.cards[cid]).filter(Boolean);
            return (
              <Column
                 key={col.id}
  column={col}
  cards={cards}
  addCard={addCard}
  updateCard={updateCard}
  deleteCard={deleteCard}
  renameColumn={renameColumn}
  deleteColumn={deleteColumn}
              />
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
