// ... existing service worker code ...

// Handle background sync
self.addEventListener('sync', event => {
  if (event.tag === 'sync-habits') {
    event.waitUntil(
      syncHabits()
    );
  }
});

async function syncHabits() {
  try {
    const pendingChanges = JSON.parse(localStorage.getItem('pendingChanges') || '[]');
    
    if (pendingChanges.length > 0) {
      // Sort changes by timestamp
      pendingChanges.sort((a, b) => a.timestamp - b.timestamp);
      
      // Apply changes in order
      const latestHabits = pendingChanges[pendingChanges.length - 1].habits;
      localStorage.setItem('habits', JSON.stringify(latestHabits));
      localStorage.removeItem('pendingChanges');
      
      // Notify the client
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_COMPLETE',
            timestamp: new Date().toISOString()
          });
        });
      });
    }
  } catch (error) {
    // Retry on next sync
    return Promise.reject(error);
  }
} 