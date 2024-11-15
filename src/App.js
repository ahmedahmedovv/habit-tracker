import { useState, useEffect } from 'react';
import './App.css';

// Error types for better error handling
const ERROR_TYPES = {
  STORAGE: 'STORAGE_ERROR',
  SYNC: 'SYNC_ERROR',
  SERVICE_WORKER: 'SW_ERROR',
  NETWORK: 'NETWORK_ERROR',
  DATA: 'DATA_ERROR'
};

// Custom error logger
const logError = (type, error, details = {}) => {
  const errorLog = {
    type,
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    details,
  };
  
  // Save error to localStorage for debugging
  const errors = JSON.parse(localStorage.getItem('habitTrackerErrors') || '[]');
  errors.push(errorLog);
  localStorage.setItem('habitTrackerErrors', JSON.stringify(errors.slice(-10))); // Keep last 10 errors
  
  console.error('Habit Tracker Error:', errorLog);
};

function App() {
  const [habits, setHabits] = useState(() => {
    try {
      const savedHabits = localStorage.getItem('habits');
      return savedHabits ? JSON.parse(savedHabits) : [];
    } catch (error) {
      logError(ERROR_TYPES.STORAGE, error, { action: 'init_habits' });
      return [];
    }
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
  const [errorMessage, setErrorMessage] = useState(null);
  const [lastError, setLastError] = useState(null);

  // Handle background sync registration
  useEffect(() => {
    const registerSync = async () => {
      try {
        if (!('serviceWorker' in navigator)) {
          throw new Error('Service Worker not supported');
        }
        if (!('sync' in navigator.serviceWorker)) {
          throw new Error('Background Sync not supported');
        }

        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-habits');
      } catch (error) {
        logError(ERROR_TYPES.SERVICE_WORKER, error);
        setErrorMessage('Background sync not available');
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
      if (pendingChanges.length === 0) return;

      setSyncStatus('syncing');
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        localStorage.setItem('habits', JSON.stringify(habits));
        setPendingChanges([]);
        localStorage.removeItem('pendingChanges');
        setSyncStatus('synced');
        setErrorMessage(null);
      } catch (error) {
        logError(ERROR_TYPES.SYNC, error, { pendingChanges });
        setSyncStatus('error');
        setErrorMessage('Sync failed. Will retry automatically.');
      }
    };

    const handleOnline = () => syncData();
    const handleOffline = () => setSyncStatus('pending');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [habits, pendingChanges]);

  // Save to localStorage with error handling
  useEffect(() => {
    try {
      localStorage.setItem('habits', JSON.stringify(habits));
    } catch (error) {
      logError(ERROR_TYPES.STORAGE, error, { habits });
      setErrorMessage('Failed to save changes');
      setLastError(error);
    }
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

  // Error boundary for data operations
  const safeDataOperation = async (operation, errorType) => {
    try {
      return await operation();
    } catch (error) {
      logError(errorType, error);
      setErrorMessage('Operation failed. Please try again.');
      setLastError(error);
      return null;
    }
  };

  // Debug helper
  const showErrorLogs = () => {
    try {
      const errors = JSON.parse(localStorage.getItem('habitTrackerErrors') || '[]');
      console.table(errors);
    } catch (error) {
      console.error('Failed to load error logs:', error);
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

        {/* Error Message Display */}
        {errorMessage && (
          <div className="error-banner" onClick={() => setErrorMessage(null)}>
            ⚠️ {errorMessage}
            <button className="error-dismiss">✕</button>
          </div>
        )}

        {/* Sync Status Indicator */}
        <div className={`sync-indicator ${syncStatus}`}>
          {syncStatus === 'synced' && '✓ All changes saved'}
          {syncStatus === 'pending' && '⏳ Changes pending...'}
          {syncStatus === 'syncing' && '↻ Syncing...'}
          {syncStatus === 'error' && '⚠️ Sync error'}
        </div>

        {/* Debug Button (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <button 
            className="debug-button"
            onClick={showErrorLogs}
          >
            Show Error Logs
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
