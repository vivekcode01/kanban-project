// In Board.jsx, Card.jsx, Column.jsx...
import { Droppable, Draggable } from '@hello-pangea/dnd';
import React, { useState } from 'react';

import CardItem from './CardItem';
export default function Column({ column, cards, addCard, updateCard, deleteCard, renameColumn, deleteColumn }) {
  const [newCardTitle, setNewCardTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [colTitle, setColTitle] = useState(column.title);

  return (
    <div className="column">
      {/* Column Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {editingTitle ? (
          <input
            value={colTitle}
            onChange={(e) => setColTitle(e.target.value)}
            onBlur={() => { renameColumn(column.id, colTitle); setEditingTitle(false); }}
            autoFocus
          />
        ) : (
          <h3 onClick={() => setEditingTitle(true)}>{column.title}</h3>
        )}
        <button onClick={() => deleteColumn(column.id)}>🗑</button>
      </div>

      {/* Cards */}
      <Droppable droppableId={column.id}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {cards.map((card, idx) => (
              <Draggable key={card.id} draggableId={card.id} index={idx}>
                {(provided) => (
                  <div
                    className="card"
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{card.title}</span>
                      <button onClick={() => deleteCard(card.id)}>❌</button>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Add Card */}
      <div>
        <input
          value={newCardTitle}
          onChange={(e) => setNewCardTitle(e.target.value)}
          placeholder="New task..."
        />
        <button onClick={() => { addCard(column.id, newCardTitle); setNewCardTitle(''); }}>
          ➕
        </button>
      </div>
    </div>
  );
}
