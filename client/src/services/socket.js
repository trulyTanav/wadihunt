import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.serverUrl = this.getSavedServerUrl();
  }

  getSavedServerUrl() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('wadihunt_server_url');
        // If a valid custom server is saved (and not obsolete localhost/3001), use it
        if (saved && !saved.includes('localhost') && !saved.includes(':3001')) {
          return saved.replace(/\/+$/, '');
        }
      }
    } catch (e) {}
    return 'https://wadihunt.onrender.com';
  }

  setServerUrl(url) {
    const cleanUrl = (url || '').trim().replace(/\/+$/, '') || 'https://wadihunt.onrender.com';
    this.serverUrl = cleanUrl;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('wadihunt_server_url', cleanUrl);
      }
    } catch (e) {}
    if (this.socket) {
      this.socket.disconnect();
      this.connect();
    }
  }

  connect() {
    if (this.socket && this.socket.connected) return this.socket;

    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      console.log('📡 Connected to WadiHunt Game Server:', this.socket.id);
      this.notifyListeners('connection_change', { connected: true, id: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('⚠️ Disconnected from Game Server:', reason);
      this.notifyListeners('connection_change', { connected: false, reason });
    });

    this.socket.on('connect_error', (err) => {
      console.error('❌ Connection error:', err.message);
      this.notifyListeners('connection_error', err);
    });

    return this.socket;
  }

  getSocket() {
    if (!this.socket) this.connect();
    return this.socket;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    const s = this.getSocket();
    s.on(event, callback);

    return () => {
      this.off(event, callback);
    };
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event, data, callback) {
    const s = this.getSocket();
    s.emit(event, data, callback);
  }

  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(data);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
}

export const socketService = new SocketService();
