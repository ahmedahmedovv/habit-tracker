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
  const [syncSupported, setSyncSupported] = useState(false);
  const [hasErrors, setHasErrors] = useState(false);

  // Check for sync support and register if available
  useEffect(() => {
    const initializeSync = async () => {
      try {
        // Check for Service Worker support
        if (!('serviceWorker' in navigator)) {
          console.log('Service Workers not supported - falling back to local storage');
          return;
        }

        // Register service worker first
        const registration = await navigator.serviceWorker.register('/serviceWorker.js');
        
        // Then check for sync support
        if ('sync' in registration) {
          setSyncSupported(true);
          await registration.sync.register('sync-habits');
          console.log('Background sync registered successfully');
        } else {
          console.log('Background Sync not supported - falling back to local storage');
        }
      } catch (error) {
        logError(ERROR_TYPES.SERVICE_WORKER, error);
        console.log('Using local storage fallback');
      }
    };

    initializeSync();
  }, []);

  // Handle data persistence with fallback
  useEffect(() => {
    const saveData = async () => {
      try {
        // Always save to localStorage as primary or fallback
        localStorage.setItem('habits', JSON.stringify(habits));
        
        if (!navigator.onLine) {
          setSyncStatus('pending');
          return;
        }

        if (syncSupported) {
          setSyncStatus('syncing');
          // If sync is supported, queue sync event
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register('sync-habits');
        } else {
          // If sync not supported, just mark as synced after localStorage save
          setSyncStatus('synced');
        }
      } catch (error) {
        logError(ERROR_TYPES.STORAGE, error, { habits });
        setErrorMessage('Failed to save changes');
      }
    };

    saveData();
  }, [habits, syncSupported]);

  // Simplified sync status display
  const getSyncStatusMessage = () => {
    if (!navigator.onLine) return '📴 Offline - Changes saved locally';
    if (!syncSupported) return '💾 Saved locally';
    
    switch (syncStatus) {
      case 'synced': return '✓ All changes saved';
      case 'pending': return '⏳ Changes pending...';
      case 'syncing': return '↻ Syncing...';
      case 'error': return '⚠️ Sync error';
      default: return '';
    }
  };

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

  // Updated error logger
  const logError = (type, error, details = {}) => {
    const errorLog = {
      type,
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      details,
    };
    
    try {
      const errors = JSON.parse(localStorage.getItem('habitTrackerErrors') || '[]');
      errors.push(errorLog);
      localStorage.setItem('habitTrackerErrors', JSON.stringify(errors.slice(-10)));
      setHasErrors(true); // Set flag when error occurs
    } catch (e) {
      console.error('Failed to log error:', e);
    }
    
    console.error('Habit Tracker Error:', errorLog);
  };

  // Debug helper
  const showErrorLogs = () => {
    try {
      const errors = JSON.parse(localStorage.getItem('habitTrackerErrors') || '[]');
      console.table(errors);
      // Clear errors after showing them
      localStorage.removeItem('habitTrackerErrors');
      setHasErrors(false);
      setErrorMessage(null);
    } catch (error) {
      console.error('Failed to load error logs:', error);
    }
  };

  // Clear error logs
  const dismissError = () => {
    setErrorMessage(null);
    if (!hasErrors) return;
    
    try {
      localStorage.removeItem('habitTrackerErrors');
      setHasErrors(false);
    } catch (error) {
      console.error('Failed to clear error logs:', error);
    }
  };

  // Add daily reset check
  useEffect(() => {
    const checkDailyReset = () => {
      const lastResetDate = localStorage.getItem('lastResetDate');
      const today = new Date().toISOString().split('T')[0];
      
      if (lastResetDate !== today) {
        // Reset all habits' completion status
        setHabits(habits.map(habit => ({
          ...habit,
          completed: false,
          // Keep the streak if completed yesterday, otherwise reset
          streak: habit.lastCompleted && 
            new Date(habit.lastCompleted).toISOString().split('T')[0] === 
            new Date(Date.now() - 86400000).toISOString().split('T')[0]
            ? habit.streak 
            : 0,
        })));
        
        localStorage.setItem('lastResetDate', today);
      }
    };

    // Check on mount and when tab becomes visible
    checkDailyReset();
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDailyReset();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up interval to check near midnight
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timeUntilMidnight = tomorrow - now;

    const midnightTimeout = setTimeout(() => {
      checkDailyReset();
      // After first midnight, check every 24 hours
      const dailyInterval = setInterval(checkDailyReset, 24 * 60 * 60 * 1000);
      return () => clearInterval(dailyInterval);
    }, timeUntilMidnight);

    return () => {
      clearTimeout(midnightTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [habits]);

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

        {/* Only show error banner when there's an error */}
        {errorMessage && (
          <div className="error-banner">
            <div className="error-content">
              <span>⚠️ {errorMessage}</span>
              {hasErrors && (
                <button 
                  className="show-logs-button"
                  onClick={showErrorLogs}
                >
                  Show Details
                </button>
              )}
            </div>
            <button 
              className="error-dismiss"
              onClick={dismissError}
            >
              ✕
            </button>
          </div>
        )}

        {/* Sync Status Indicator */}
        <div className={`sync-indicator ${syncStatus}`}>
          {getSyncStatusMessage()}
        </div>
      </div>
    </div>
  );
}

export default App;
