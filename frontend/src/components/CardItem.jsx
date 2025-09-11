 // In Board.jsx, Card.jsx, Column.jsx...
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
 import React, { useState } from 'react';


export default function CardItem({ card, index, updateCard, deleteCard }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(card.title || '');
  const [desc, setDesc] = useState(card.description || '');

  const save = () => {
    updateCard(card.id, { title: title.trim() || 'Untitled', description: desc });
    setOpen(false);
  };

  return (
    <>
      <Draggable draggableId={card.id} index={index}>
        {(provided) => (
          <div className="card" ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:600 }}>{card.title}</div>
                {card.description && <div style={{ fontSize:12, color:'#6b7280' }}>{card.description}</div>}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button className="btn btn-ghost" onClick={() => setOpen(true)}>Edit</button>
                <button className="btn btn-ghost" onClick={() => { if (window.confirm('Delete card?')) deleteCard(card.id); }}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </Draggable>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop:0 }}>Edit Card</h3>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
            <textarea className="input" rows={4} value={desc} onChange={e => setDesc(e.target.value)} style={{ marginTop:8 }} />
            <div className="controls">
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
