import { useState } from 'react';
import './App.css';

function App() {
  const [habits, setHabits] = useState([]);
  const [newHabit, setNewHabit] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  const addHabit = (e) => {
    e.preventDefault();
    if (!newHabit.trim()) return;
    
    setHabits([...habits, {
      id: Date.now(),
      name: newHabit,
      completed: false
    }]);
    setNewHabit('');
  };

  const toggleHabit = (id) => {
    setHabits(habits.map(habit => 
      habit.id === id ? { ...habit, completed: !habit.completed } : habit
    ));
  };

  const deleteHabit = (id) => {
    setHabits(habits.filter(habit => habit.id !== id));
  };

  const startEditing = (habit) => {
    setEditingId(habit.id);
    setEditingText(habit.name);
  };

  const saveEdit = (id) => {
    if (!editingText.trim()) return;
    
    setHabits(habits.map(habit =>
      habit.id === id ? { ...habit, name: editingText.trim() } : habit
    ));
    setEditingId(null);
    setEditingText('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  return (
    <div className="App">
      <div className="habit-tracker">
        <h1>Habit Tracker</h1>
        
        <form onSubmit={addHabit}>
          <input
            type="text"
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            placeholder="Enter a new habit"
          />
          <button type="submit">Add Habit</button>
        </form>

        <div className="habits-list">
          {habits.map(habit => (
            <div key={habit.id} className="habit-item">
              <input
                type="checkbox"
                checked={habit.completed}
                onChange={() => toggleHabit(habit.id)}
              />
              {editingId === habit.id ? (
                <div className="edit-mode">
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    autoFocus
                  />
                  <button onClick={() => saveEdit(habit.id)} className="save">Save</button>
                  <button onClick={cancelEdit} className="cancel">Cancel</button>
                </div>
              ) : (
                <>
                  <span className={habit.completed ? 'completed' : ''}>
                    {habit.name}
                  </span>
                  <div className="button-group">
                    <button onClick={() => startEditing(habit)} className="edit">Edit</button>
                    <button onClick={() => deleteHabit(habit.id)} className="delete">Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
