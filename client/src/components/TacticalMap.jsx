import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Crosshair, Plus, Minus, Navigation, ShieldAlert, Radio, Layers } from 'lucide-react';
import { socketService } from '../services/socket';

export default function TacticalMap({
  roomState,
  currentPlayer,
  myPosition,
  activePings = [],
  incidentAlert = null,
  locateTargetCoord = null,
  isSimulated = false,
  onMapClick = null
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map()); // id -> { marker, role, status, isMe, isPingActive, headingEl }
  const zoneCircleRef = useRef(null);
  const nextZoneCircleRef = useRef(null);
  const bearingLineRef = useRef(null);
  const incidentMarkerRef = useRef(null);
  const radarEchoesRef = useRef(new Map());
  const hasAutoCenteredRef = useRef(false);
  const tileLayersRef = useRef({ base: null, labels: null });

  const [autoFollow, setAutoFollow] = useState(true);
  const [mapTheme, setMapTheme] = useState('dark'); // 'dark' | 'satellite'
  const autoFollowRef = useRef(true);
  autoFollowRef.current = autoFollow;

  // Initialize Leaflet map with dark tactical tiles and robust sizing
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialLat = myPosition?.lat || roomState?.settings?.zoneCenter?.lat || 37.7749;
    const initialLng = myPosition?.lng || roomState?.settings?.zoneCenter?.lng || -122.4194;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true
    });

    // High-performance Tactical Dark basemap using Esri Dark Gray Canvas (Native dark, razor-sharp roads, 100% free, zero watermark)
    const baseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      maxNativeZoom: 16,
      attribution: '&copy; Esri, HERE, Garmin'
    }).addTo(map);

    const labelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      maxNativeZoom: 16,
      opacity: 0.95
    }).addTo(map);

    tileLayersRef.current = { base: baseLayer, labels: labelsLayer };

    // Disable autoFollow if user manually drags or touches the map
    map.on('dragstart', () => {
      setAutoFollow(false);
    });

    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    });

    mapRef.current = map;

    // Invalidate size to guarantee complete tile rendering without grey edges
    const timer1 = setTimeout(() => map.invalidateSize(), 150);
    const timer2 = setTimeout(() => map.invalidateSize(), 600);

    // ResizeObserver ensures canvas always fills viewport even on orientation change
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (resizeObserver) resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Center on player's REAL GPS coordinates upon first valid lock
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (myPosition?.lat != null && myPosition?.lng != null) {
      if (!hasAutoCenteredRef.current) {
        hasAutoCenteredRef.current = true;
        map.setView([myPosition.lat, myPosition.lng], 17, { animate: true });
      } else if (autoFollowRef.current) {
        map.panTo([myPosition.lat, myPosition.lng], { animate: true, duration: 0.3 });
      }
    }
  }, [myPosition?.lat, myPosition?.lng]);

  // Update Safe Zone circle & next shrink preview
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const center = roomState?.settings?.zoneCenter || myPosition;
    if (!center || center.lat == null || center.lng == null) return;

    const currentRadius = roomState?.currentZoneRadius || roomState?.settings?.zoneRadius || 500;
    const shrinkRatio = roomState?.settings?.shrinkRatio || 0.75;
    const minRadius = roomState?.settings?.minZoneRadius || 75;
    const nextRadius = Math.max(minRadius, Math.round(currentRadius * shrinkRatio));

    // Active Zone
    if (!zoneCircleRef.current) {
      zoneCircleRef.current = L.circle([center.lat, center.lng], {
        radius: currentRadius,
        color: '#7C4DFF',
        weight: 2.5,
        fillColor: '#7C4DFF',
        fillOpacity: 0.12
      }).addTo(map);
    } else {
      zoneCircleRef.current.setLatLng([center.lat, center.lng]);
      zoneCircleRef.current.setRadius(currentRadius);
    }

    // Next Shrink Preview Circle
    if (!nextZoneCircleRef.current) {
      nextZoneCircleRef.current = L.circle([center.lat, center.lng], {
        radius: nextRadius,
        color: '#B39DFF',
        weight: 1.5,
        dashArray: '5, 8',
        fill: false,
        opacity: 0.6
      }).addTo(map);
    } else {
      nextZoneCircleRef.current.setLatLng([center.lat, center.lng]);
      nextZoneCircleRef.current.setRadius(nextRadius);
    }
  }, [roomState?.currentZoneRadius, roomState?.settings?.zoneCenter, myPosition]);

  // Helper to build marker HTML
  const buildMarkerHtml = useCallback((player, isMe, isPingActive) => {
    const isHunter = player.role === 'HUNTER';
    const isCaught = player.status === 'CAUGHT';
    const isOffline = player.isOnline === false;
    const heading = isMe ? (myPosition?.heading || 0) : (player.heading || 0);
    const avatar = player.avatar;
    const isPhoto = avatar && (avatar.startsWith('data:image/') || avatar.startsWith('http'));
    
    // Map preset ID to emoji
    const emojiMap = {
      wolf: '🐺', raven: '🦅', viper: '🐍', ghost: '👻', skull: '💀', target: '🎯', cyber: '⚡', fox: '🦊'
    };
    const emoji = avatar ? (emojiMap[avatar] || null) : null;
    const roleClass = isHunter ? 'gateboy' : 'runner';
    const roleColor = isHunter ? '#FF2A55' : '#00F5D4';

    const avatarInnerHtml = isPhoto
      ? `<img src="${avatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;" />`
      : emoji
      ? `<span style="font-size: 14px; line-height: 1;">${emoji}</span>`
      : isHunter
      ? `<span style="font-size: 14px; line-height: 1;">🎯</span>`
      : `<span style="font-size: 14px; line-height: 1;">🏃</span>`;

    return `
      <div class="player-gps-container">
        <!-- Faded Directional Field-of-View Beam & Pointer Notch -->
        <div class="gps-facing-beam-wrap heading-indicator" style="transform: rotate(${heading}deg);">
          <div class="gps-facing-beam ${roleClass}"></div>
          <div class="gps-facing-pointer ${roleClass}"></div>
        </div>

        <!-- Subtle gentle ring for current player -->
        ${isMe ? `<div class="gps-me-ring" style="color: ${roleColor};"></div>` : ''}

        <!-- Clean GPS Player Puck -->
        <div class="gps-puck ${roleClass} ${isCaught ? 'caught' : ''}">
          ${isCaught ? '💀' : avatarInnerHtml}
        </div>
      </div>

      <!-- High-legibility Name Tag -->
      <div class="gps-name-badge" style="color: ${isCaught ? '#888' : roleColor}; border: 1px solid ${isCaught ? '#444' : roleColor}50;">
        ${player.name || (isHunter ? 'Gateboy' : 'Runner')} ${isMe ? '(YOU)' : ''} ${isOffline ? '⚠️' : ''}
      </div>
    `;
  }, [myPosition?.heading]);

  // Sync / create markers based on roomState.players
  const updateAllMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !roomState?.players) return;

    const currentMarkers = markersRef.current;
    const activePlayerIds = new Set();
    const isMeHunter = currentPlayer?.role === 'HUNTER';
    const isPingActive = Boolean(roomState?.isPingActive);

    roomState.players.forEach((player) => {
      const isMe = player.id === currentPlayer?.id;
      const lat = isMe ? myPosition.lat : player.lat;
      const lng = isMe ? myPosition.lng : player.lng;
      const heading = isMe ? (myPosition?.heading || 0) : (player.heading || 0);

      if (lat == null || lng == null) return;

      // Visibility Rules:
      // 1. You always see yourself
      // 2. Hunters always see fellow hunters
      // 3. Shadows always see fellow shadows
      // 4. Hunters only see shadows if radar ping is active or player is caught
      // 5. In game over / lobby, see everyone
      let canSee = false;
      if (isMe) {
        canSee = true;
      } else if (roomState.state === 'LOBBY' || roomState.state === 'GAME_OVER') {
        canSee = true;
      } else if (isMeHunter) {
        if (player.role === 'HUNTER') {
          canSee = true;
        } else if (player.status === 'CAUGHT') {
          canSee = true;
        } else if (isPingActive) {
          canSee = true;
        }
      } else {
        // I am a Shadow
        if (player.role === 'SHADOW') {
          canSee = true;
        }
      }

      if (!canSee) {
        if (currentMarkers.has(player.id)) {
          map.removeLayer(currentMarkers.get(player.id).marker);
          currentMarkers.delete(player.id);
        }
        return;
      }

      activePlayerIds.add(player.id);

      const existing = currentMarkers.get(player.id);
      const stateChanged = !existing ||
        existing.role !== player.role ||
        existing.status !== player.status ||
        existing.isPingActive !== isPingActive ||
        existing.isMe !== isMe;

      if (stateChanged) {
        // Rebuild or create icon
        const html = buildMarkerHtml(player, isMe, isPingActive);
        const icon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `<div class="marker-inner-wrap" style="display: flex; flex-direction: column; align-items: center; justify-content: center; transform: translate(-50%, -50%);">${html}</div>`,
          iconSize: [60, 60],
          iconAnchor: [30, 30]
        });

        if (!existing) {
          const marker = L.marker([lat, lng], { icon }).addTo(map);
          currentMarkers.set(player.id, {
            marker,
            role: player.role,
            status: player.status,
            isMe,
            isPingActive,
            lat,
            lng,
            heading
          });
        } else {
          existing.marker.setIcon(icon);
          existing.marker.setLatLng([lat, lng]);
          existing.role = player.role;
          existing.status = player.status;
          existing.isPingActive = isPingActive;
          existing.isMe = isMe;
          existing.lat = lat;
          existing.lng = lng;
          existing.heading = heading;
        }
      } else {
        // Smoothly update position without destroying the DOM icon
        existing.marker.setLatLng([lat, lng]);
        existing.lat = lat;
        existing.lng = lng;
        existing.heading = heading;

        // Smoothly update heading beam for player
        const el = existing.marker.getElement();
        if (el) {
          const beam = el.querySelector('.heading-indicator');
          if (beam) {
            beam.style.transform = `rotate(${heading}deg)`;
          }
        }
      }
    });

    // Remove obsolete markers
    for (const [id, entry] of currentMarkers.entries()) {
      if (!activePlayerIds.has(id)) {
        map.removeLayer(entry.marker);
        currentMarkers.delete(id);
      }
    }
  }, [roomState?.players, roomState?.isPingActive, roomState?.state, myPosition, currentPlayer, buildMarkerHtml]);

  // Run updateAllMarkers on state changes
  useEffect(() => {
    updateAllMarkers();
  }, [updateAllMarkers]);

  // DIRECT ZERO-DELAY SOCKET LISTENER FOR REALTIME PLAYER MOVEMENT
  useEffect(() => {
    const unsubMoved = socketService.on('player_moved', (data) => {
      const map = mapRef.current;
      if (!map || !data || !data.id) return;

      const isMe = data.id === currentPlayer?.id;
      if (isMe) return; // Your own position is smoothly driven by myPosition

      const currentMarkers = markersRef.current;
      const isMeHunter = currentPlayer?.role === 'HUNTER';
      const isPingActive = Boolean(roomState?.isPingActive);

      // Check visibility
      let canSee = false;
      if (roomState?.state === 'LOBBY' || roomState?.state === 'GAME_OVER') {
        canSee = true;
      } else if (isMeHunter) {
        if (data.role === 'HUNTER' || data.status === 'CAUGHT' || isPingActive) {
          canSee = true;
        }
      } else {
        if (data.role === 'SHADOW') {
          canSee = true;
        }
      }

      if (!canSee) {
        if (currentMarkers.has(data.id)) {
          map.removeLayer(currentMarkers.get(data.id).marker);
          currentMarkers.delete(data.id);
        }
        return;
      }

      const existing = currentMarkers.get(data.id);
      if (existing) {
        // Fast glide to new position
        existing.marker.setLatLng([data.lat, data.lng]);
        existing.lat = data.lat;
        existing.lng = data.lng;
        if (data.heading != null) {
          existing.heading = data.heading;
          const el = existing.marker.getElement();
          if (el) {
            const beam = el.querySelector('.heading-indicator');
            if (beam) {
              beam.style.transform = `rotate(${data.heading}deg)`;
            }
          }
        }
      } else {
        // Trigger marker creation
        updateAllMarkers();
      }
    });

    return () => unsubMoved();
  }, [currentPlayer?.id, currentPlayer?.role, roomState?.isPingActive, roomState?.state, updateAllMarkers]);

  // Bearing line from Hunter to closest Shadow
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const isMeHunter = currentPlayer?.role === 'HUNTER';
    if (!isMeHunter || !myPosition || myPosition.lat == null) {
      if (bearingLineRef.current) {
        map.removeLayer(bearingLineRef.current);
        bearingLineRef.current = null;
      }
      return;
    }

    // Find nearest visible shadow
    const shadows = (roomState?.players || []).filter(
      (p) => p.role === 'SHADOW' && p.status === 'ALIVE' && p.lat != null
    );

    let nearest = null;
    let minDist = Infinity;
    shadows.forEach((s) => {
      const d = Math.hypot(s.lat - myPosition.lat, s.lng - myPosition.lng);
      if (d < minDist) {
        minDist = d;
        nearest = s;
      }
    });

    if (nearest && (roomState?.isPingActive || minDist < 0.0035)) {
      const latlngs = [
        [myPosition.lat, myPosition.lng],
        [nearest.lat, nearest.lng]
      ];
      if (!bearingLineRef.current) {
        bearingLineRef.current = L.polyline(latlngs, {
          color: '#FF2A55',
          weight: 2,
          dashArray: '5, 8',
          opacity: 0.8
        }).addTo(map);
      } else {
        bearingLineRef.current.setLatLngs(latlngs);
      }
    } else {
      if (bearingLineRef.current) {
        map.removeLayer(bearingLineRef.current);
        bearingLineRef.current = null;
      }
    }
  }, [roomState?.players, roomState?.isPingActive, myPosition, currentPlayer]);

  // Temporary Crime Scene / Incident Skull Beacon on map when runner caught
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !incidentAlert || incidentAlert.lat == null || incidentAlert.lng == null) return;

    if (incidentMarkerRef.current) {
      map.removeLayer(incidentMarkerRef.current);
      incidentMarkerRef.current = null;
    }

    const html = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; pointer-events: none;">
        <div style="width: 34px; height: 34px; border-radius: 50%; background: rgba(255, 42, 85, 0.35); border: 2px solid #FF2A55; display: flex; align-items: center; justify-content: center; font-size: 16px; animation: beacon-pulse 1.2s infinite; box-shadow: 0 0 18px #FF2A55;">
          💀
        </div>
        <div style="background: rgba(11, 9, 20, 0.94); border: 1px solid #FF2A55; color: #FF2A55; font-family: 'Space Mono', monospace; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-top: 4px; white-space: nowrap; box-shadow: 0 2px 8px #000;">
          ${(incidentAlert.shadowName || 'RUNNER').toUpperCase()} ELIMINATED
        </div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'incident-ping-marker',
      html: `<div style="transform: translate(-50%, -50%);">${html}</div>`,
      iconSize: [60, 60],
      iconAnchor: [30, 30]
    });

    const marker = L.marker([incidentAlert.lat, incidentAlert.lng], { icon, zIndexOffset: 2000 }).addTo(map);
    incidentMarkerRef.current = marker;

    const timeout = setTimeout(() => {
      if (incidentMarkerRef.current && mapRef.current) {
        mapRef.current.removeLayer(incidentMarkerRef.current);
        incidentMarkerRef.current = null;
      }
    }, 12000);

    return () => clearTimeout(timeout);
  }, [incidentAlert]);

  // Hunter smooth target locate
  useEffect(() => {
    if (!mapRef.current || !locateTargetCoord || locateTargetCoord.lat == null) return;
    setAutoFollow(false);
    mapRef.current.setView([locateTargetCoord.lat, locateTargetCoord.lng], 18, { animate: true, duration: 0.6 });
  }, [locateTargetCoord]);

  // Persistent Radar Echoes on Map for Hunters (Shows where runners were last spotted)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || currentPlayer?.role !== 'HUNTER') return;

    const pings = (roomState?.lastPings && roomState.lastPings.length > 0) ? roomState.lastPings : activePings;
    if (!pings || pings.length === 0) return;

    pings.forEach((ping) => {
      if (ping.lat == null || ping.lng == null) return;

      const html = `
        <div class="radar-echo-ping">
          <div class="radar-echo-ring"></div>
          <div style="background: rgba(11, 9, 20, 0.94); border: 1.5px solid #00F5D4; color: #00F5D4; font-family: 'Space Mono', monospace; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-top: -6px; white-space: nowrap; box-shadow: 0 2px 6px #000;">
            📍 LAST SEEN: ${(ping.name || 'RUNNER').toUpperCase()}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'radar-echo-marker',
        html: `<div style="transform: translate(-50%, -50%);">${html}</div>`,
        iconSize: [60, 60],
        iconAnchor: [30, 30]
      });

      const existing = radarEchoesRef.current.get(ping.id);
      if (existing) {
        existing.setLatLng([ping.lat, ping.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([ping.lat, ping.lng], { icon, zIndexOffset: 400 }).addTo(map);
        radarEchoesRef.current.set(ping.id, marker);
      }
    });
  }, [roomState?.lastPings, activePings, currentPlayer?.role]);

  // Pan camera smoothly when hunter taps LOCATE TARGET
  useEffect(() => {
    if (!locateTargetCoord || !mapRef.current) return;
    setAutoFollow(false);
    mapRef.current.flyTo([locateTargetCoord.lat, locateTargetCoord.lng], 18, {
      duration: 1.2
    });
  }, [locateTargetCoord]);

  // Map Controls
  const handleRecenter = () => {
    if (!mapRef.current || !myPosition?.lat) return;
    setAutoFollow(true);
    mapRef.current.setView([myPosition.lat, myPosition.lng], 18, { animate: true, duration: 0.6 });
  };

  const handleToggleTheme = () => {
    const map = mapRef.current;
    if (!map) return;
    const nextTheme = mapTheme === 'dark' ? 'satellite' : 'dark';
    setMapTheme(nextTheme);

    if (tileLayersRef.current.base) map.removeLayer(tileLayersRef.current.base);
    if (tileLayersRef.current.labels) map.removeLayer(tileLayersRef.current.labels);

    if (nextTheme === 'satellite') {
      const base = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 20,
        maxNativeZoom: 18,
        attribution: '&copy; Esri World Imagery'
      }).addTo(map);

      const labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 20,
        maxNativeZoom: 18,
        opacity: 0.85
      }).addTo(map);

      tileLayersRef.current = { base, labels };
    } else {
      const base = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 20,
        maxNativeZoom: 16,
        attribution: '&copy; Esri, HERE, Garmin'
      }).addTo(map);

      const labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 20,
        maxNativeZoom: 16,
        opacity: 0.95
      }).addTo(map);

      tileLayersRef.current = { base, labels };
    }
  };

  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating Tactical Map Controls (Right Side) */}
      <div
        style={{
          position: 'absolute',
          right: '16px',
          bottom: '160px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 500
        }}
      >
        {/* Recenter & Lock button */}
        <button
          onClick={handleRecenter}
          className="btn btn-icon cut-sm"
          style={{
            background: autoFollow ? 'var(--p-600)' : 'rgba(20, 14, 38, 0.92)',
            border: autoFollow ? '1px solid var(--p-300)' : '1px solid var(--line)',
            color: autoFollow ? '#fff' : 'var(--p-300)',
            boxShadow: autoFollow ? '0 0 16px rgba(124, 77, 255, 0.6)' : '0 4px 14px rgba(0,0,0,0.5)',
            transition: 'all 0.2s ease'
          }}
          title={autoFollow ? 'Locked to your position' : 'Click to center on me'}
        >
          <Crosshair size={20} className={autoFollow ? 'pulse-animation' : ''} />
        </button>

        {/* Toggle Map Layer (Dark / Satellite Recon) */}
        <button
          onClick={handleToggleTheme}
          className="btn btn-icon cut-sm"
          style={{
            background: mapTheme === 'satellite' ? 'rgba(0, 245, 212, 0.2)' : 'rgba(20, 14, 38, 0.92)',
            border: mapTheme === 'satellite' ? '1px solid var(--hunter-color)' : '1px solid var(--line)',
            color: mapTheme === 'satellite' ? 'var(--hunter-color)' : 'var(--p-300)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)'
          }}
          title={mapTheme === 'dark' ? 'Switch to Satellite Recon' : 'Switch to Tactical Dark'}
        >
          <Layers size={18} />
        </button>

        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          className="btn btn-icon cut-sm"
          style={{
            background: 'rgba(20, 14, 38, 0.92)',
            border: '1px solid var(--line)',
            color: 'var(--p-300)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)'
          }}
          title="Zoom In"
        >
          <Plus size={18} />
        </button>

        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          className="btn btn-icon cut-sm"
          style={{
            background: 'rgba(20, 14, 38, 0.92)',
            border: '1px solid var(--line)',
            color: 'var(--p-300)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)'
          }}
          title="Zoom Out"
        >
          <Minus size={18} />
        </button>
      </div>

      {/* Simulation Mode Watermark / Tap hint */}
      {isSimulated && (
        <div
          style={{
            position: 'absolute',
            top: '90px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 183, 3, 0.2)',
            border: '1px solid var(--warning-color)',
            color: 'var(--warning-color)',
            padding: '4px 12px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            letterSpacing: '0.05em',
            pointerEvents: 'none',
            zIndex: 500,
            backdropFilter: 'blur(6px)',
            whiteSpace: 'nowrap'
          }}
          className="cut-sm"
        >
          🎮 TAP MAP OR USE D-PAD TO MOVE
        </div>
      )}
    </div>
  );
}
