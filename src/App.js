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
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced', 'pending', 'error'
  const [pendingChanges, setPendingChanges] = useState(() => {
    const savedChanges = localStorage.getItem('pendingChanges');
    return savedChanges ? JSON.parse(savedChanges) : [];
  });

  // Handle background sync registration
  useEffect(() => {
    const registerSync = async () => {
      if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register('sync-habits');
        } catch (error) {
          console.log('Background sync registration failed:', error);
        }
      }
    };

    registerSync();
  }, []);

  // Handle offline changes
  useEffect(() => {
    if (!navigator.onLine && habits.length > 0) {
      setPendingChanges(prev => [...prev, { timestamp: Date.now(), habits }]);
      setSyncStatus('pending');
      localStorage.setItem('pendingChanges', JSON.stringify(pendingChanges));
    }
  }, [habits, pendingChanges]);

  // Handle online/offline status
  useEffect(() => {
    const syncData = async () => {
      if (pendingChanges.length > 0) {
        setSyncStatus('syncing');
        try {
          localStorage.setItem('habits', JSON.stringify(habits));
          setPendingChanges([]);
          localStorage.removeItem('pendingChanges');
          setSyncStatus('synced');
        } catch (error) {
          setSyncStatus('error');
        }
      }
    };

    const handleOnline = () => {
      setSyncStatus('syncing');
      syncData();
    };

    const handleOffline = () => {
      setSyncStatus('pending');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingChanges, habits]);

  // Save to localStorage
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

  const exportData = () => {
    const habitData = JSON.stringify(habits, null, 2);
    const blob = new Blob([habitData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `habits-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedHabits = JSON.parse(e.target.result);
        setHabits(importedHabits);
      } catch (error) {
        alert('Error importing habits. Please check the file format.');
      }
    };
    reader.readAsText(file);
    // Reset file input
    event.target.value = '';
  };

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    
    const result = await installPrompt.prompt();
    if (result.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  return (
    <div className="App">
      <div className="habit-tracker">
        <h1>Habit Tracker</h1>
        
        {installPrompt && !isInstalled && (
          <div className="install-prompt">
            <button onClick={handleInstallClick} className="install-button">
              📱 Install App
            </button>
          </div>
        )}
        
        <div className="data-controls">
          <button onClick={exportData} className="export">
            ↓ Export
          </button>
          <label className="import-label">
            ↑ Import
            <input
              type="file"
              accept=".json"
              onChange={importData}
              className="import-input"
            />
          </label>
        </div>

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

        {/* Sync Status Indicator */}
        <div className={`sync-indicator ${syncStatus}`}>
          {syncStatus === 'synced' && '✓ All changes saved'}
          {syncStatus === 'pending' && '⏳ Changes pending...'}
          {syncStatus === 'syncing' && '↻ Syncing...'}
          {syncStatus === 'error' && '⚠️ Sync error'}
        </div>
      </div>
    </div>
  );
}

export default App;
