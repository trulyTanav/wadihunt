import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.join(__dirname, '../../client/dist');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(clientDist));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Haversine formula for distance in meters
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Bearing from point 1 to point 2 in degrees (0 = North, 90 = East)
function getBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

// In-memory rooms
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function createDefaultSettings() {
  return {
    gameDuration: 1800,        // 30 mins
    headStartDuration: 180,    // 3 mins
    pingInterval: 180,         // Every 3 mins
    pingDuration: 15,          // Revealed for 15s
    zoneRadius: 500,           // 500m start
    shrinkInterval: 600,       // Shrinks every 10 mins
    shrinkRatio: 0.75,         // Down to 75%
    minZoneRadius: 75,         // Don't shrink below 75m
    tagDistance: 12,           // 12 meters tag distance
    infectionMode: false,      // If true, tagged runners turn into hunters
    zoneCenter: null           // { lat, lng }
  };
}

class GameRoom {
  constructor(code, hostId, hostName, hostUserToken = null) {
    this.code = code;
    this.hostId = hostId;
    this.hostUserToken = hostUserToken;
    this.state = 'LOBBY'; // 'LOBBY' | 'HEAD_START' | 'ACTIVE' | 'GAME_OVER'
    this.players = new Map(); // id -> player object
    this.disconnectTimers = new Map(); // userToken/id -> timer
    this.settings = createDefaultSettings();
    this.timer = null;
    this.elapsedSeconds = 0;
    this.headStartRemaining = 0;
    this.matchRemaining = 0;
    this.nextPingCountdown = 0;
    this.isPingActive = false;
    this.currentZoneRadius = 500;
    this.feedMessages = [];
    this.chatMessages = [];
    this.voicePeers = new Map(); // id -> { id, name, role, avatar, channel, isMuted, isSpeaking }
    this.lastPings = []; // [{ id, name, lat, lng, timestamp }]
    this.winner = null; // 'HUNTERS' | 'SHADOWS'
    this.matchStartTime = null;
  }

  addPlayer(id, name, isHost = false, avatar = null, userToken = null) {
    // If player already exists by userToken or id (reconnection / tab resume)
    let existing = this.players.get(id);
    if (!existing && userToken) {
      existing = Array.from(this.players.values()).find(p => p.userToken === userToken);
      if (existing) {
        this.players.delete(existing.id);
        existing.id = id;
      }
    }

    if (existing) {
      existing.id = id;
      existing.isOnline = true;
      if (name) existing.name = name.slice(0, 16);
      if (avatar) existing.avatar = avatar;
      if (userToken) existing.userToken = userToken;
      // Preserve host status for this userToken
      if ((this.hostUserToken && existing.userToken === this.hostUserToken) || existing.isHost) {
        this.hostId = id;
        this.hostUserToken = existing.userToken;
        existing.isHost = true;
      }
      this.players.set(id, existing);
      return existing;
    }

    const token = userToken || `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const shouldBeHost = Boolean(isHost || (this.hostUserToken && token === this.hostUserToken));

    const player = {
      id,
      userToken: token,
      name: (name || 'Operative').slice(0, 16),
      avatar: avatar || 'wolf',
      role: 'SHADOW',
      status: 'ALIVE',
      lat: null,
      lng: null,
      heading: 0,
      accuracy: 0,
      speed: 0,
      lastUpdate: Date.now(),
      isHost: shouldBeHost,
      isBot: false,
      isOnline: true,
      tagsCount: 0
    };

    if (player.isHost) {
      this.hostId = id;
      this.hostUserToken = token;
    }

    this.players.set(id, player);
    return player;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return null;
    this.players.delete(id);
    if (this.hostId === id && this.players.size > 0) {
      // Reassign host to next real online player, or any real player
      const nextHost = Array.from(this.players.values()).find(pl => !pl.isBot && pl.isOnline) ||
                       Array.from(this.players.values()).find(pl => !pl.isBot) ||
                       Array.from(this.players.values())[0];
      if (nextHost) {
        this.hostId = nextHost.id;
        this.hostUserToken = nextHost.userToken;
        nextHost.isHost = true;
      }
    }
    return p;
  }

  addBot(role = 'SHADOW') {
    const botNum = Array.from(this.players.values()).filter(p => p.isBot).length + 1;
    const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const center = this.settings.zoneCenter || { lat: 37.7749, lng: -122.4194 };
    
    // Spread randomly within 40% of zone radius
    const angle = Math.random() * Math.PI * 2;
    const dist = (Math.random() * 0.4 + 0.1) * (this.currentZoneRadius || 300);
    const dLat = (dist * Math.cos(angle)) / 111111;
    const dLng = (dist * Math.sin(angle)) / (111111 * Math.cos(center.lat * Math.PI / 180));

    const bot = {
      id: botId,
      name: `${role === 'HUNTER' ? 'Gateboy' : 'Ghost'}-${botNum}`,
      avatar: role === 'HUNTER' ? 'target' : 'ghost',
      role: role,
      status: 'ALIVE',
      lat: center.lat + dLat,
      lng: center.lng + dLng,
      heading: Math.floor(Math.random() * 360),
      accuracy: 5,
      speed: 1.5,
      lastUpdate: Date.now(),
      isHost: false,
      isBot: true,
      isOnline: true,
      tagsCount: 0,
      botVelocity: {
        angle: Math.random() * Math.PI * 2,
        speed: 1.2 + Math.random() * 1.0 // 1.2 to 2.2 m/s
      }
    };
    this.players.set(botId, bot);
    return bot;
  }

  updateBots() {
    if (this.state !== 'ACTIVE' && this.state !== 'HEAD_START') return;
    const center = this.settings.zoneCenter;
    if (!center) return;

    for (const player of this.players.values()) {
      if (!player.isBot || player.status !== 'ALIVE') continue;

      // In HEAD_START, hunters don't move yet
      if (this.state === 'HEAD_START' && player.role === 'HUNTER') continue;

      // Update bot position
      const dt = 1; // 1 second tick
      let { angle, speed } = player.botVelocity;

      // Gentle random course wandering
      angle += (Math.random() - 0.5) * 0.5;

      // If near edge of zone, steer towards center
      const distFromCenter = getDistanceMeters(center.lat, center.lng, player.lat, player.lng);
      if (distFromCenter > this.currentZoneRadius * 0.85) {
        const toCenter = (getBearing(player.lat, player.lng, center.lat, center.lng) * Math.PI / 180);
        angle = toCenter + (Math.random() - 0.5) * 0.4;
      }

      player.botVelocity.angle = angle;
      const meters = speed * dt;
      const dLat = (meters * Math.cos(angle)) / 111111;
      const dLng = (meters * Math.sin(angle)) / (111111 * Math.cos(player.lat * Math.PI / 180));

      player.lat += dLat;
      player.lng += dLng;
      player.heading = Math.round((angle * 180 / Math.PI + 360) % 360);
      player.lastUpdate = Date.now();

      // Broadcast bot movement immediately so all clients see bots move in real time
      io.to(this.code).emit('player_moved', {
        id: player.id,
        name: player.name,
        role: player.role,
        status: player.status,
        lat: player.lat,
        lng: player.lng,
        heading: player.heading,
        accuracy: player.accuracy || 5,
        speed: player.speed || 1.5,
        isBot: true,
        timestamp: Date.now()
      });

      // Bot Hunter AI: If bot is hunter and in active game, search for nearest alive runner
      if (player.role === 'HUNTER' && this.state === 'ACTIVE') {
        let nearestRunner = null;
        let minDist = Infinity;
        for (const other of this.players.values()) {
          if (other.role === 'SHADOW' && other.status === 'ALIVE' && other.lat != null) {
            const d = getDistanceMeters(player.lat, player.lng, other.lat, other.lng);
            if (d < minDist) {
              minDist = d;
              nearestRunner = other;
            }
          }
        }
        if (nearestRunner && minDist < 150) {
          // Steer towards runner
          const huntAngle = getBearing(player.lat, player.lng, nearestRunner.lat, nearestRunner.lng) * Math.PI / 180;
          player.botVelocity.angle = huntAngle;
          if (minDist <= this.settings.tagDistance) {
            // Tag runner!
            this.tagRunner(nearestRunner.id, player.id);
          }
        }
      }
    }
  }

  addFeedMessage(text, type = 'info') {
    const msg = { id: Date.now() + Math.random(), text, type, time: Date.now() };
    this.feedMessages.push(msg);
    if (this.feedMessages.length > 50) this.feedMessages.shift();
    io.to(this.code).emit('feed_message', msg);
  }

  startMatch() {
    if (this.state !== 'LOBBY' && this.state !== 'GAME_OVER') return false;

    // Check player distribution
    const playersList = Array.from(this.players.values());
    const hunters = playersList.filter(p => p.role === 'HUNTER');
    const shadows = playersList.filter(p => p.role === 'SHADOW');

    if (hunters.length === 0 || shadows.length === 0) {
      return { success: false, error: 'Must have at least 1 Gateboy and 1 Runner!' };
    }

    // Determine zone center if not manually set: average of all players' positions or host
    if (!this.settings.zoneCenter) {
      const validCoords = playersList.filter(p => p.lat != null && p.lng != null);
      if (validCoords.length > 0) {
        const avgLat = validCoords.reduce((acc, p) => acc + p.lat, 0) / validCoords.length;
        const avgLng = validCoords.reduce((acc, p) => acc + p.lng, 0) / validCoords.length;
        this.settings.zoneCenter = { lat: avgLat, lng: avgLng };
      } else {
        this.settings.zoneCenter = { lat: 37.7749, lng: -122.4194 }; // Fallback
      }
    }

    // Reset player statuses
    for (const p of this.players.values()) {
      p.status = 'ALIVE';
      p.tagsCount = 0;
    }

    this.currentZoneRadius = this.settings.zoneRadius;
    this.elapsedSeconds = 0;
    this.matchRemaining = this.settings.gameDuration;
    this.headStartRemaining = this.settings.headStartDuration;
    this.nextPingCountdown = this.settings.pingInterval;
    this.isPingActive = false;
    this.winner = null;
    this.feedMessages = [];
    this.lastPings = [];
    this.matchStartTime = Date.now();

    if (this.headStartRemaining > 0) {
      this.state = 'HEAD_START';
      this.addFeedMessage(`Head start begun (${Math.round(this.headStartRemaining / 60)}m)! Runners scatter and hide!`, 'alert');
    } else {
      this.state = 'ACTIVE';
      this.addFeedMessage('Gateboys released! The hunt is on!', 'alert');
      this.triggerPing();
    }

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 1000);

    this.broadcastState();
    return { success: true };
  }

  triggerPing() {
    this.isPingActive = true;
    this.lastPings = [];

    // Capture runner positions
    for (const p of this.players.values()) {
      if (p.role === 'SHADOW' && p.status === 'ALIVE' && p.lat != null) {
        this.lastPings.push({
          id: p.id,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          accuracy: p.accuracy,
          timestamp: Date.now()
        });
      }
    }

    this.addFeedMessage(`Radar ping! ${this.lastPings.length} Runners exposed for ${this.settings.pingDuration}s!`, 'ping');
    io.to(this.code).emit('radar_ping', {
      pings: this.lastPings,
      duration: this.settings.pingDuration
    });

    // Schedule hide
    setTimeout(() => {
      this.isPingActive = false;
      io.to(this.code).emit('radar_ping_end');
    }, this.settings.pingDuration * 1000);
  }

  tagRunner(shadowId, hunterId) {
    const shadow = this.players.get(shadowId);
    const hunter = this.players.get(hunterId);

    if (!shadow || shadow.role !== 'SHADOW' || shadow.status !== 'ALIVE') return false;

    if (this.settings.infectionMode) {
      shadow.role = 'HUNTER';
      shadow.status = 'ALIVE';
      this.addFeedMessage(`⚠️ ${shadow.name} was tagged by ${hunter ? hunter.name : 'a Gateboy'} and INFECTED into a Gateboy!`, 'danger');
    } else {
      shadow.status = 'CAUGHT';
      this.addFeedMessage(`🎯 ${shadow.name} was caught by ${hunter ? hunter.name : 'a Gateboy'}!`, 'danger');
    }

    if (hunter) hunter.tagsCount = (hunter.tagsCount || 0) + 1;

    io.to(this.code).emit('player_tagged', {
      shadowId: shadow.id,
      shadowName: shadow.name,
      lat: shadow.lat,
      lng: shadow.lng,
      hunterId: hunter ? hunter.id : null,
      hunterName: hunter ? hunter.name : null,
      isInfected: this.settings.infectionMode
    });

    this.checkWinConditions();
    this.broadcastState();
    return true;
  }

  checkWinConditions() {
    if (this.state !== 'ACTIVE') return;

    const shadows = Array.from(this.players.values()).filter(p => p.role === 'SHADOW');
    const aliveShadows = shadows.filter(p => p.status === 'ALIVE');

    if (aliveShadows.length === 0) {
      this.endMatch('HUNTERS', 'All Runners have been captured! Gateboys win!');
    } else if (this.matchRemaining <= 0) {
      this.endMatch('SHADOWS', 'Time expired! Surviving Runners win!');
    }
  }

  endMatch(winner, reason) {
    this.state = 'GAME_OVER';
    this.winner = winner;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.addFeedMessage(`🏁 GAME OVER: ${reason}`, 'victory');
    io.to(this.code).emit('match_ended', {
      winner,
      reason,
      summary: this.getMatchSummary()
    });
    this.broadcastState();
  }

  getMatchSummary() {
    const playersList = Array.from(this.players.values());
    return {
      durationSeconds: this.elapsedSeconds,
      winner: this.winner,
      hunters: playersList.filter(p => p.role === 'HUNTER').map(p => ({
        id: p.id,
        name: p.name,
        tagsCount: p.tagsCount || 0
      })),
      shadows: playersList.filter(p => p.role === 'SHADOW').map(p => ({
        id: p.id,
        name: p.name,
        status: p.status
      }))
    };
  }

  tick() {
    this.elapsedSeconds++;
    this.updateBots();

    if (this.state === 'HEAD_START') {
      this.headStartRemaining--;
      if (this.headStartRemaining <= 0) {
        this.state = 'ACTIVE';
        this.addFeedMessage('🚨 Head start complete! Gateboys are RELEASED! Run!', 'alert');
        this.triggerPing();
      }
    } else if (this.state === 'ACTIVE') {
      this.matchRemaining--;

      // Ping countdown
      this.nextPingCountdown--;
      if (this.nextPingCountdown <= 0) {
        this.triggerPing();
        this.nextPingCountdown = this.settings.pingInterval;
      }

      // Safe Zone Shrink calculation
      const shrinkInterval = this.settings.shrinkInterval;
      if (this.elapsedSeconds > 0 && this.elapsedSeconds % shrinkInterval === 0) {
        const nextRadius = Math.max(
          this.settings.minZoneRadius,
          Math.round(this.currentZoneRadius * this.settings.shrinkRatio)
        );
        if (nextRadius < this.currentZoneRadius) {
          this.currentZoneRadius = nextRadius;
          this.addFeedMessage(`⚡ The Zone has shrunk to ${this.currentZoneRadius}m radius!`, 'zone');
        }
      }

      // Check boundary violations for Shadows
      const center = this.settings.zoneCenter;
      if (center) {
        for (const p of this.players.values()) {
          if (p.role === 'SHADOW' && p.status === 'ALIVE' && p.lat != null) {
            const dist = getDistanceMeters(center.lat, center.lng, p.lat, p.lng);
            if (dist > this.currentZoneRadius) {
              // Runner is outside the safe zone!
              if (!p.wasOutsideZone) {
                p.wasOutsideZone = true;
                this.addFeedMessage(`⚠️ ${p.name} is OUTSIDE the safe zone! Return immediately!`, 'warning');
                io.to(p.id).emit('zone_warning', { isOutside: true, distanceOut: Math.round(dist - this.currentZoneRadius) });
              }
            } else {
              if (p.wasOutsideZone) {
                p.wasOutsideZone = false;
                io.to(p.id).emit('zone_warning', { isOutside: false });
              }
            }
          }
        }
      }

      // Proximity alerts between Hunters and Shadows
      this.checkProximities();

      this.checkWinConditions();
    }

    // Broadcast time sync every 1 second
    io.to(this.code).emit('time_sync', {
      state: this.state,
      elapsedSeconds: this.elapsedSeconds,
      headStartRemaining: this.headStartRemaining,
      matchRemaining: this.matchRemaining,
      nextPingCountdown: this.nextPingCountdown,
      currentZoneRadius: this.currentZoneRadius,
      nextZoneRadius: Math.max(this.settings.minZoneRadius, Math.round(this.currentZoneRadius * this.settings.shrinkRatio))
    });
  }

  checkProximities() {
    if (this.state !== 'ACTIVE') return;
    const hunters = Array.from(this.players.values()).filter(p => p.role === 'HUNTER' && p.lat != null);
    const shadows = Array.from(this.players.values()).filter(p => p.role === 'SHADOW' && p.status === 'ALIVE' && p.lat != null);

    for (const h of hunters) {
      let closestShadow = null;
      let closestDist = Infinity;
      let closestBearing = 0;

      for (const s of shadows) {
        const d = getDistanceMeters(h.lat, h.lng, s.lat, s.lng);
        if (d < closestDist) {
          closestDist = d;
          closestShadow = s;
          closestBearing = getBearing(h.lat, h.lng, s.lat, s.lng);
        }
      }

      // Send tactical telemetry to hunter
      io.to(h.id).emit('hunter_telemetry', {
        nearestDistance: closestDist === Infinity ? null : Math.round(closestDist),
        nearestBearing: closestBearing,
        nearestShadowId: closestShadow ? closestShadow.id : null,
        nearestShadowName: closestShadow ? closestShadow.name : null,
        nearestShadowLat: closestShadow ? closestShadow.lat : null,
        nearestShadowLng: closestShadow ? closestShadow.lng : null,
        canTag: closestDist <= this.settings.tagDistance
      });
    }

    for (const s of shadows) {
      let closestHunterDist = Infinity;
      let closestHunterBearing = 0;
      for (const h of hunters) {
        const d = getDistanceMeters(s.lat, s.lng, h.lat, h.lng);
        if (d < closestHunterDist) {
          closestHunterDist = d;
          closestHunterBearing = getBearing(s.lat, s.lng, h.lat, h.lng);
        }
      }

      io.to(s.id).emit('shadow_telemetry', {
        nearestHunterDistance: closestHunterDist === Infinity ? null : Math.round(closestHunterDist),
        nearestHunterBearing: closestHunterBearing,
        inDanger: closestHunterDist < 30,
        inCriticalDanger: closestHunterDist < 15
      });
    }
  }

  updateSingleHunterTelemetry(h) {
    if (!h || h.lat == null) return;
    const shadows = Array.from(this.players.values()).filter(p => p.role === 'SHADOW' && p.status === 'ALIVE' && p.lat != null);
    let closestShadow = null;
    let closestDist = Infinity;
    let closestBearing = 0;

    for (const s of shadows) {
      const d = getDistanceMeters(h.lat, h.lng, s.lat, s.lng);
      if (d < closestDist) {
        closestDist = d;
        closestShadow = s;
        closestBearing = getBearing(h.lat, h.lng, s.lat, s.lng);
      }
    }

    io.to(h.id).emit('hunter_telemetry', {
      nearestDistance: closestDist === Infinity ? null : Math.round(closestDist),
      nearestBearing: closestBearing,
      nearestShadowId: closestShadow ? closestShadow.id : null,
      nearestShadowName: closestShadow ? closestShadow.name : null,
      nearestShadowLat: closestShadow ? closestShadow.lat : null,
      nearestShadowLng: closestShadow ? closestShadow.lng : null,
      canTag: closestDist <= (this.settings.tagDistance || 15)
    });
  }

  // Real-time zero-delay proximity calculation for a moving player
  checkProximityForPlayer(movedPlayer) {
    if (this.state !== 'ACTIVE' || movedPlayer.lat == null) return;
    const isHunter = movedPlayer.role === 'HUNTER';
    const hunters = Array.from(this.players.values()).filter(p => p.role === 'HUNTER' && p.lat != null);
    const shadows = Array.from(this.players.values()).filter(p => p.role === 'SHADOW' && p.status === 'ALIVE' && p.lat != null);

    if (isHunter) {
      this.updateSingleHunterTelemetry(movedPlayer);

      for (const s of shadows) {
        const d = getDistanceMeters(movedPlayer.lat, movedPlayer.lng, s.lat, s.lng);
        if (d < 40) {
          const bearingToH = getBearing(s.lat, s.lng, movedPlayer.lat, movedPlayer.lng);
          io.to(s.id).emit('shadow_telemetry', {
            nearestHunterDistance: Math.round(d),
            nearestHunterBearing: bearingToH,
            inDanger: d < 30,
            inCriticalDanger: d < 15
          });
        }
      }
    } else {
      // movedPlayer is Shadow
      let closestHunterDist = Infinity;
      let closestHunterBearing = 0;
      let closestHunter = null;

      for (const h of hunters) {
        const d = getDistanceMeters(movedPlayer.lat, movedPlayer.lng, h.lat, h.lng);
        if (d < closestHunterDist) {
          closestHunterDist = d;
          closestHunterBearing = getBearing(movedPlayer.lat, movedPlayer.lng, h.lat, h.lng);
          closestHunter = h;
        }
      }

      io.to(movedPlayer.id).emit('shadow_telemetry', {
        nearestHunterDistance: closestHunterDist === Infinity ? null : Math.round(closestHunterDist),
        nearestHunterBearing: closestHunterBearing,
        inDanger: closestHunterDist < 30,
        inCriticalDanger: closestHunterDist < 15
      });

      // Crucial: Calculate the true closest shadow for this hunter among ALL shadows
      // (prevents distant runners from overwriting a close runner's tag telemetry)
      if (closestHunter) {
        this.updateSingleHunterTelemetry(closestHunter);
      }
    }
  }

  broadcastState() {
    io.to(this.code).emit('room_state', this.toStateObject());
  }

  toStateObject() {
    return {
      code: this.code,
      hostId: this.hostId,
      state: this.state,
      settings: this.settings,
      elapsedSeconds: this.elapsedSeconds,
      headStartRemaining: this.headStartRemaining,
      matchRemaining: this.matchRemaining,
      nextPingCountdown: this.nextPingCountdown,
      isPingActive: this.isPingActive,
      currentZoneRadius: this.currentZoneRadius,
      winner: this.winner,
      lastPings: this.lastPings || [],
      chatMessages: (this.chatMessages || []).slice(-50),
      voicePeers: Array.from((this.voicePeers || new Map()).values()),
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        userToken: p.userToken,
        name: p.name,
        avatar: p.avatar || 'wolf',
        role: p.role,
        status: p.status,
        isHost: p.isHost,
        isBot: p.isBot,
        isOnline: p.isOnline !== false,
        tagsCount: p.tagsCount || 0,
        lat: p.lat,
        lng: p.lng,
        heading: p.heading,
        accuracy: p.accuracy
      }))
    };
  }
}

// Socket.io handlers
io.on('connection', (socket) => {
  let currentRoom = null;
  let playerId = socket.id;

  // Create room
  socket.on('create_room', ({ playerName, avatar, settings, coords, userToken }, callback) => {
    const code = generateRoomCode();
    const token = userToken || `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const room = new GameRoom(code, playerId, playerName || 'Host', token);
    if (settings) Object.assign(room.settings, settings);
    if (coords && coords.lat != null && coords.lng != null) {
      room.settings.zoneCenter = { lat: coords.lat, lng: coords.lng };
    }

    const hostPlayer = room.addPlayer(playerId, playerName || 'Host', true, avatar, token);
    if (coords && coords.lat != null && coords.lng != null) {
      hostPlayer.lat = coords.lat;
      hostPlayer.lng = coords.lng;
    }
    rooms.set(code, room);
    currentRoom = room;

    socket.join(code);
    callback({ success: true, roomCode: code, state: room.toStateObject() });
    room.addFeedMessage(`${playerName || 'Host'} created lobby ${code}`);
  });

  // Join room
  socket.on('join_room', ({ roomCode, playerName, avatar, coords, userToken }, callback) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      return callback({ success: false, error: 'Room not found! Check the room code.' });
    }

    // Cancel pending disconnect grace timer for this userToken
    if (userToken && room.disconnectTimers && room.disconnectTimers.has(userToken)) {
      clearTimeout(room.disconnectTimers.get(userToken));
      room.disconnectTimers.delete(userToken);
    }

    const isHostCandidate = Boolean(room.hostUserToken && userToken && userToken === room.hostUserToken);
    const player = room.addPlayer(playerId, playerName || `Player ${room.players.size + 1}`, isHostCandidate, avatar, userToken);
    if (coords && coords.lat != null && coords.lng != null) {
      player.lat = coords.lat;
      player.lng = coords.lng;
    }
    currentRoom = room;
    socket.join(code);

    callback({ success: true, roomCode: code, state: room.toStateObject() });
    room.addFeedMessage(`${player.name} joined the hunt`);
    room.broadcastState();
  });

  // Update profile (codename or photo/avatar)
  socket.on('update_profile', ({ name, avatar }) => {
    if (!currentRoom) return;
    const player = currentRoom.players.get(playerId);
    if (!player) return;
    if (name && name.trim()) {
      player.name = name.trim().slice(0, 16);
    }
    if (avatar) {
      player.avatar = avatar;
    }
    currentRoom.broadcastState();
  });

  // Update player role
  socket.on('set_role', ({ role }) => {
    if (!currentRoom) return;
    const player = currentRoom.players.get(playerId);
    if (!player) return;
    player.role = role === 'HUNTER' ? 'HUNTER' : 'SHADOW';
    currentRoom.broadcastState();
  });

  // Host update player role for any player
  socket.on('host_set_player_role', ({ targetPlayerId, role }) => {
    if (!currentRoom || currentRoom.hostId !== playerId) return;
    const target = currentRoom.players.get(targetPlayerId);
    if (target) {
      target.role = role;
      currentRoom.broadcastState();
    }
  });

  // Auto balance roles: distribute X hunters and Y runners
  socket.on('auto_distribute_roles', ({ hunterCount }) => {
    if (!currentRoom || currentRoom.hostId !== playerId) return;
    const playersList = Array.from(currentRoom.players.values());
    const total = playersList.length;
    let targetHunters = Math.max(1, Math.min(total - 1, hunterCount || Math.ceil(total * 0.3)));
    
    // Shuffle
    const shuffled = [...playersList].sort(() => Math.random() - 0.5);
    shuffled.forEach((p, idx) => {
      p.role = idx < targetHunters ? 'HUNTER' : 'SHADOW';
    });
    currentRoom.addFeedMessage(`Auto-balanced: ${targetHunters} Gateboys vs ${total - targetHunters} Runners`);
    currentRoom.broadcastState();
  });

  // Host update settings
  socket.on('update_settings', (newSettings) => {
    if (!currentRoom || currentRoom.hostId !== playerId) return;
    Object.assign(currentRoom.settings, newSettings);
    if (newSettings.zoneRadius && currentRoom.state === 'LOBBY') {
      currentRoom.currentZoneRadius = newSettings.zoneRadius;
    }
    currentRoom.broadcastState();
  });

  // Add Bot
  socket.on('add_bot', ({ role }) => {
    if (!currentRoom || currentRoom.hostId !== playerId) return;
    const bot = currentRoom.addBot(role);
    currentRoom.addFeedMessage(`Added simulated bot ${bot.name} (${bot.role === 'HUNTER' ? 'Gateboy' : 'Runner'})`);
    currentRoom.broadcastState();
  });

  // Remove player / bot
  socket.on('kick_player', ({ targetPlayerId }) => {
    if (!currentRoom || currentRoom.hostId !== playerId) return;
    currentRoom.removePlayer(targetPlayerId);
    currentRoom.broadcastState();
  });

  // Update location
  socket.on('update_location', ({ lat, lng, heading, accuracy, speed }) => {
    if (!currentRoom) return;
    const player = currentRoom.players.get(playerId);
    if (!player) return;

    player.lat = lat;
    player.lng = lng;
    if (heading != null) player.heading = heading;
    if (accuracy != null) player.accuracy = accuracy;
    if (speed != null) player.speed = speed;
    player.lastUpdate = Date.now();

    // Broadcast movement to all other players in the room with full telemetry
    socket.to(currentRoom.code).emit('player_moved', {
      id: player.id,
      name: player.name,
      role: player.role,
      status: player.status,
      lat: player.lat,
      lng: player.lng,
      heading: player.heading,
      accuracy: player.accuracy,
      speed: player.speed,
      timestamp: Date.now()
    });

    // Immediate zero-delay proximity telemetry update for moving player & target
    if (currentRoom.state === 'ACTIVE') {
      currentRoom.checkProximityForPlayer(player);
    }
  });

  // Start game
  socket.on('start_game', (callback) => {
    if (!currentRoom || currentRoom.hostId !== playerId) {
      return callback && callback({ success: false, error: 'Only the host can start the match.' });
    }
    const result = currentRoom.startMatch();
    if (callback) callback(result);
  });

  // Runner self-tag ("I Got Tagged" honour system)
  socket.on('self_tag', () => {
    if (!currentRoom) return;
    currentRoom.tagRunner(playerId, null);
  });

  // Hunter tag request
  socket.on('hunter_tag_runner', ({ shadowId }, callback) => {
    if (!currentRoom) return;
    const hunter = currentRoom.players.get(playerId);
    if (!hunter || hunter.role !== 'HUNTER' || hunter.lat == null) {
      return callback && callback({ success: false, error: 'Only gateboys can tag runners.' });
    }

    let targetShadow = shadowId ? currentRoom.players.get(shadowId) : null;
    if (!targetShadow || targetShadow.status !== 'ALIVE' || targetShadow.role !== 'SHADOW') {
      // Find closest alive runner
      let closest = null;
      let minD = Infinity;
      for (const p of currentRoom.players.values()) {
        if (p.role === 'SHADOW' && p.status === 'ALIVE' && p.lat != null) {
          const d = getDistanceMeters(hunter.lat, hunter.lng, p.lat, p.lng);
          if (d < minD) {
            minD = d;
            closest = p;
          }
        }
      }
      targetShadow = closest;
    }

    if (!targetShadow) {
      return callback && callback({ success: false, error: 'No alive runner in range.' });
    }

    const dist = getDistanceMeters(hunter.lat, hunter.lng, targetShadow.lat, targetShadow.lng);
    // Allow up to 1.8x tag distance to account for GPS variance
    if (dist <= currentRoom.settings.tagDistance * 1.8 || targetShadow.isBot) {
      const tagged = currentRoom.tagRunner(targetShadow.id, hunter.id);
      if (callback) callback({ success: tagged, distance: Math.round(dist), shadowName: targetShadow.name });
    } else {
      if (callback) callback({ success: false, error: `Too far! Distance is ${Math.round(dist)}m (must be within ${currentRoom.settings.tagDistance}m)` });
    }
  });

  // Reset to lobby
  socket.on('reset_to_lobby', () => {
    if (!currentRoom || currentRoom.hostId !== playerId) return;
    currentRoom.state = 'LOBBY';
    if (currentRoom.timer) {
      clearInterval(currentRoom.timer);
      currentRoom.timer = null;
    }
    for (const p of currentRoom.players.values()) {
      p.status = 'ALIVE';
      p.tagsCount = 0;
    }
    currentRoom.broadcastState();
  });

  // ── CHAT SYSTEM ──────────────────────────────────
  socket.on('send_chat', ({ text, channel = 'ALL' }) => {
    if (!currentRoom || !text || !text.trim()) return;
    const player = currentRoom.players.get(playerId);
    if (!player) return;

    const message = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      senderId: player.id,
      senderName: player.name,
      senderRole: player.role,
      senderAvatar: player.avatar,
      channel: channel, // 'ALL' | 'HUNTER' | 'SHADOW'
      text: text.trim().slice(0, 200),
      time: Date.now()
    };

    currentRoom.chatMessages.push(message);
    if (currentRoom.chatMessages.length > 100) currentRoom.chatMessages.shift();

    if (channel === 'ALL') {
      io.to(currentRoom.code).emit('chat_message', message);
    } else {
      // Role-specific private channel (Gateboys or Runners)
      for (const p of currentRoom.players.values()) {
        if (p.role === channel) {
          io.to(p.id).emit('chat_message', message);
        }
      }
    }
  });

  // ── WEBRTC VOICE CHAT LOBBY ──────────────────────
  socket.on('voice_join', ({ channel = 'GLOBAL' }) => {
    if (!currentRoom) return;
    const player = currentRoom.players.get(playerId);
    if (!player) return;

    const voiceInfo = {
      id: player.id,
      name: player.name,
      role: player.role,
      avatar: player.avatar,
      channel: channel, // 'GLOBAL' | 'TEAM'
      isMuted: false,
      isDeafened: false,
      isSpeaking: false
    };

    currentRoom.voicePeers.set(player.id, voiceInfo);

    // Tell the room this peer joined voice
    io.to(currentRoom.code).emit('voice_peer_joined', voiceInfo);

    // Send back current list of voice peers
    const peersList = Array.from(currentRoom.voicePeers.values());
    socket.emit('voice_peers_list', peersList);
    currentRoom.broadcastState();
  });

  socket.on('voice_leave', () => {
    if (!currentRoom) return;
    if (currentRoom.voicePeers.has(playerId)) {
      currentRoom.voicePeers.delete(playerId);
      io.to(currentRoom.code).emit('voice_peer_left', { peerId: playerId });
      currentRoom.broadcastState();
    }
  });

  socket.on('voice_signal', ({ targetPeerId, signal }) => {
    if (!currentRoom) return;
    io.to(targetPeerId).emit('voice_signal', {
      senderPeerId: playerId,
      signal
    });
  });

  socket.on('voice_speaking', ({ isSpeaking }) => {
    if (!currentRoom) return;
    const peer = currentRoom.voicePeers.get(playerId);
    if (peer) {
      peer.isSpeaking = Boolean(isSpeaking);
      io.to(currentRoom.code).emit('voice_speaking_update', {
        peerId: playerId,
        isSpeaking: peer.isSpeaking
      });
    }
  });

  socket.on('voice_mute_toggle', ({ isMuted }) => {
    if (!currentRoom) return;
    const peer = currentRoom.voicePeers.get(playerId);
    if (peer) {
      peer.isMuted = Boolean(isMuted);
      io.to(currentRoom.code).emit('voice_mute_update', {
        peerId: playerId,
        isMuted: peer.isMuted
      });
      currentRoom.broadcastState();
    }
  });

  socket.on('voice_deafen_toggle', ({ isDeafened }) => {
    if (!currentRoom) return;
    const peer = currentRoom.voicePeers.get(playerId);
    if (peer) {
      peer.isDeafened = Boolean(isDeafened);
      io.to(currentRoom.code).emit('voice_deafen_update', {
        peerId: playerId,
        isDeafened: peer.isDeafened
      });
      currentRoom.broadcastState();
    }
  });

  // Disconnect with robust 90-second grace period for outdoor/background play
  socket.on('disconnect', () => {
    if (currentRoom) {
      if (currentRoom.voicePeers.has(playerId)) {
        currentRoom.voicePeers.delete(playerId);
        io.to(currentRoom.code).emit('voice_peer_left', { peerId: playerId });
      }
      const player = currentRoom.players.get(playerId);
      if (player && !player.isBot) {
        player.isOnline = false;
        currentRoom.addFeedMessage(`${player.name} paused (reconnecting...)`);
        currentRoom.broadcastState();

        const graceKey = player.userToken || player.id;
        if (currentRoom.disconnectTimers.has(graceKey)) {
          clearTimeout(currentRoom.disconnectTimers.get(graceKey));
        }

        // 90-second grace timer for mobile screen lock, backgrounding, or cell handover
        const timer = setTimeout(() => {
          currentRoom.disconnectTimers.delete(graceKey);
          const currentP = Array.from(currentRoom.players.values()).find(
            p => (p.userToken && p.userToken === graceKey) || p.id === playerId
          );
          if (currentP && currentP.isOnline === false) {
            currentRoom.removePlayer(currentP.id);
            currentRoom.addFeedMessage(`${currentP.name} left the room`);
            if (currentRoom.players.size === 0) {
              if (currentRoom.timer) clearInterval(currentRoom.timer);
              rooms.delete(currentRoom.code);
            } else {
              currentRoom.broadcastState();
            }
          }
        }, 90000);

        currentRoom.disconnectTimers.set(graceKey, timer);
      }
    }
  });
});

// Fallback to client index.html for Single Page App routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`📡 WadiHunt Game Server running on port ${PORT}`);
});
