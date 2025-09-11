import React from 'react';
import Board from './components/Board';
import './index.css';

function App() {
  return (
    <div className="app">
      <div className="header">
        <h1>Kanban — Frontend (local demo)</h1>
        <div>
          <small className="small">Local demo • data saved in localStorage</small>
        </div>
      </div>

      <Board />

      <div className="footer">
        Next: connect to socket backend for real-time collaboration (I can help with that next).
      </div>
    </div>
  );
}

export default App;
