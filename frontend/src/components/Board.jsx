import { DragDropContext } from '@hello-pangea/dnd';
import React, { useEffect, useState, useCallback } from 'react';
import Column from './Column';
import axios from 'axios';
import io from 'socket.io-client'; // 1. Import socket.io-client

const API_URL = "https://kanban-backend-api-8q9j.onrender.com/api";
const SOCKET_URL = "https://kanban-backend-api-8q9j.onrender.com"; // 2. Add your backend URL for the socket connection
const BOARD_ID = "board-1";

export default function Board() {
  const [data, setData] = useState(null);
  const [newColTitle, setNewColTitle] = useState('');

  // 3. Wrap data fetching in useCallback so it can be used in multiple effects
  const fetchBoard = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/board/${BOARD_ID}`);
      if (!res.data.board) {
        // create board if not exists
        await axios.post(`${API_URL}/board`, { id: BOARD_ID, title: "My Kanban" });
        return fetchBoard();
      }

      const { columns, cards } = res.data;

      // Create a map of all cards for easy lookup
      const cardMap = {};
      cards.forEach(card => { cardMap[card.id] = card; });

      // Create the map of columns, ensuring cards within are sorted
      const columnMap = {};
      columns.forEach(col => {
        // 1. Find all cards that belong to this column
        const cardsInColumn = cards.filter(card => card.ColumnId === col.id);
        
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
  }, []); // Empty dependency array because it has no external dependencies

  // Load initial board data
  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // 4. Add a new useEffect hook for WebSocket connection and listeners
  useEffect(() => {
    // Connect to the WebSocket server
    // This is the NEW, corrected line
const socket = io(SOCKET_URL, {
  transports: ['websocket']
});

    // Listen for the 'board.updated' event
    // This event should be emitted by your server after any change to the board (add, delete, move, etc.)
    socket.on('board.updated', () => {
      console.log('Board update received via WebSocket. Refetching data...');
      fetchBoard();
    });

    // Clean up the connection when the component unmounts
    return () => {
      socket.disconnect();
    };
  }, [fetchBoard]); // Rerun if fetchBoard changes (which it won't, due to useCallback)

  if (!data) return <p>Loading board...</p>;

  // This function is no longer needed since state is updated by re-fetching.
  // However, optimistic updates can use it for a snappier UI feel.
  // We will keep it for the drag-and-drop optimistic update.
  const persist = (next) => setData(next);

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const start = data.columns[source.droppableId];
    const finish = data.columns[destination.droppableId];

    // --- Start Optimistic Update ---
    // This part updates the UI immediately for a smooth user experience
    // The server will send a 'board.updated' event which will correct any inconsistencies.
    if (start === finish) {
      const newCardIds = Array.from(start.cardIds);
      newCardIds.splice(source.index, 1);
      newCardIds.splice(destination.index, 0, draggableId);

      const newColumn = { ...start, cardIds: newCardIds };
      const next = {
        ...data,
        columns: { ...data.columns, [newColumn.id]: newColumn },
      };
      persist(next);
    } else {
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
      };
      persist(next);
    }
    // --- End Optimistic Update ---

    // Send the update to the server. The server will handle updating the database
    // and then emitting the 'board.updated' event to all clients.
    await axios.put(`${API_URL}/card/${draggableId}/move`, {
      newColumnId: destination.droppableId,
      newPosition: destination.index,
    });
  };

  // --- CRUD Operations ---
  // These functions now only need to make the API request.
  // The state update will be handled by the WebSocket listener.

  const addColumn = async (title) => {
    if (!title) return;
    await axios.post(`${API_URL}/column`, {
      title,
      position: data.columnOrder.length,
      boardId: BOARD_ID,
    });
    setNewColTitle(''); // Clear input
  };

  const addCard = async (colId, title) => {
    if (!title) return;
    await axios.post(`${API_URL}/card`, {
      title,
      description: "",
      position: data.columns[colId].cardIds.length,
      columnId: colId,
    });
  };

  const updateCard = async (cardId, updates) => {
    const card = { ...data.cards[cardId], ...updates };
    await axios.put(`${API_URL}/card/${cardId}`, card);
  };

  const deleteCard = async (cardId) => {
    await axios.delete(`${API_URL}/card/${cardId}`);
  };

  const renameColumn = async (colId, newTitle) => {
    if (!newTitle) return;
    const col = { ...data.columns[colId], title: newTitle };
    await axios.put(`${API_URL}/column/${colId}`, col);
  };

  const deleteColumn = async (colId) => {
    await axios.delete(`${API_URL}/column/${colId}`);
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