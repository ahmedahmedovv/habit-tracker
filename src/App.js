import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [habits, setHabits] = useState(() => {
    const savedHabits = localStorage.getItem('habits');
    return savedHabits ? JSON.parse(savedHabits) : [];
  });
  const [newHabit, setNewHabit] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    localStorage.setItem('habits', JSON.stringify(habits));
  }, [habits]);

  const addHabit = (e) => {
    e.preventDefault();
    if (!newHabit.trim()) return;
    
    setHabits([...habits, {
      id: Date.now(),
      name: newHabit,
      completed: false,
      streak: 0,
      lastCompleted: null,
      startDate: new Date().toISOString()
    }]);
    setNewHabit('');
  };

  const toggleHabit = (id) => {
    const today = new Date().toISOString().split('T')[0];
    
    setHabits(habits.map(habit => {
      if (habit.id !== id) return habit;

      const lastCompletedDate = habit.lastCompleted ? 
        new Date(habit.lastCompleted).toISOString().split('T')[0] : null;
      
      // If already completed today, uncomplete it
      if (lastCompletedDate === today) {
        return {
          ...habit,
          completed: false,
          streak: Math.max(0, habit.streak - 1),
          lastCompleted: null
        };
      }

      // If completing for the first time or continuing streak
      const isNextDay = lastCompletedDate &&
        new Date(today) - new Date(lastCompletedDate) <= 1000 * 60 * 60 * 24;
      
      return {
        ...habit,
        completed: true,
        streak: isNextDay ? habit.streak + 1 : 1,
        lastCompleted: new Date().toISOString()
      };
    }));
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
                  <div className="habit-info">
                    <span className={habit.completed ? 'completed' : ''}>
                      {habit.name}
                    </span>
                    {habit.streak > 0 && (
                      <span className="streak-badge">
                        🔥 {habit.streak} day{habit.streak !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
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
