// Geolocation service with support for High-Accuracy Real GPS, Native Capacitor, and Simulation Mode
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

class GeoService {
  constructor() {
    this.watchId = null;
    this.capacitorWatchId = null;
    this.orientationListener = null;
    this.subscribers = new Set();
    this.isSimulated = false;
    this.hasRealLock = false;

    this.lastLat = null;
    this.lastLng = null;
    this.lastHeading = 0;
    this.lastHeadingNotifyTime = 0;
    this.lastLocationTime = 0;
    this.lastGpsHeading = null;
    this.lastGpsHeadingTime = 0;

    // Default starting point (will be immediately overridden by real GPS or custom center)
    this.currentPosition = {
      lat: 37.7749,
      lng: -122.4194,
      heading: 0,
      accuracy: 5,
      speed: 0,
      timestamp: Date.now(),
      hasRealLock: false
    };
  }

  setSimulated(enabled, customCoords = null) {
    this.isSimulated = enabled;
    if (enabled) {
      this.hasRealLock = true;
      this.currentPosition.hasRealLock = true;
      if (customCoords && customCoords.lat != null && customCoords.lng != null) {
        this.currentPosition.lat = customCoords.lat;
        this.currentPosition.lng = customCoords.lng;
      }
      this.stopTracking();
    } else {
      this.hasRealLock = false;
      this.currentPosition.hasRealLock = false;
      this.startTracking();
    }
    this.notify();
  }

  // Move simulated player by distance in meters and bearing in degrees
  moveSimulated(distanceMeters, bearingDegrees) {
    if (!this.isSimulated) return;
    const rad = (bearingDegrees * Math.PI) / 180;
    const dLat = (distanceMeters * Math.cos(rad)) / 111111;
    const dLng = (distanceMeters * Math.sin(rad)) / (111111 * Math.cos((this.currentPosition.lat * Math.PI) / 180));

    this.currentPosition.lat += dLat;
    this.currentPosition.lng += dLng;
    this.currentPosition.heading = Math.round(bearingDegrees);
    this.currentPosition.speed = 1.8;
    this.currentPosition.hasRealLock = true;
    this.currentPosition.timestamp = Date.now();
    this.notify();
  }

  // Set position directly from map click (when in simulation mode)
  setSimulatedCoords(lat, lng) {
    if (!this.isSimulated) return;
    this.currentPosition.lat = lat;
    this.currentPosition.lng = lng;
    this.currentPosition.hasRealLock = true;
    this.currentPosition.timestamp = Date.now();
    this.notify();
  }

  // Common position update processor with zero delay
  updateFromCoords(coords, timestamp = Date.now()) {
    if (this.isSimulated) return;
    if (coords == null || coords.latitude == null || coords.longitude == null) return;

    const now = timestamp || Date.now();
    const lat = coords.latitude;
    const lng = coords.longitude;
    const accuracy = Math.round(coords.accuracy || 4);

    let speed = coords.speed;
    let heading = coords.heading;

    // If speed is not provided by hardware, estimate from delta distance & time
    if (speed == null && this.lastLat != null && this.lastLng != null && this.lastLocationTime > 0) {
      const dt = (now - this.lastLocationTime) / 1000;
      if (dt > 0.3 && dt < 10) {
        const dLat = (lat - this.lastLat) * 111111;
        const dLng = (lng - this.lastLng) * 111111 * Math.cos((lat * Math.PI) / 180);
        const dist = Math.hypot(dLat, dLng);
        speed = Math.min(15, Math.round((dist / dt) * 10) / 10); // cap to sprint speed ~15 m/s
        if (dist > 1.0 && heading == null) {
          const brng = (Math.atan2(dLng, dLat) * 180) / Math.PI;
          heading = (brng + 360) % 360;
        }
      }
    }

    if (heading != null) {
      this.lastGpsHeading = Math.round(heading);
      this.lastGpsHeadingTime = now;
    }

    this.lastLat = lat;
    this.lastLng = lng;
    this.lastLocationTime = now;
    this.hasRealLock = true;

    this.currentPosition = {
      lat,
      lng,
      heading: heading != null ? Math.round(heading) : (this.currentPosition.heading || 0),
      accuracy,
      speed: speed != null ? Math.max(0, speed) : (this.currentPosition.speed || 0),
      timestamp: now,
      hasRealLock: true
    };

    this.notify();
  }

  async startTracking() {
    if (this.isSimulated) return;

    // 1. Try Native Capacitor Geolocation on Android/iOS
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await Geolocation.requestPermissions();
        if (perm.location === 'granted' || perm.coarseLocation === 'granted') {
          // Instant fix
          Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          }).then((pos) => {
            if (pos && pos.coords) this.updateFromCoords(pos.coords, pos.timestamp);
          }).catch(() => {});

          // Continuous watch
          this.capacitorWatchId = await Geolocation.watchPosition(
            {
              enableHighAccuracy: true,
              timeout: 6000,
              maximumAge: 0
            },
            (pos, err) => {
              if (err) {
                console.warn('Capacitor GPS error:', err.message);
                return;
              }
              if (pos && pos.coords) {
                this.updateFromCoords(pos.coords, pos.timestamp);
              }
            }
          );
          this.initCompass();
          return;
        }
      } catch (err) {
        console.warn('Capacitor Geolocation init failed, falling back to Web API:', err);
      }
    }

    // 2. Standard Web Geolocation API (for Chrome, Safari, Android WebView)
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      // Immediate quick fix (no caching)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.updateFromCoords(pos.coords, pos.timestamp);
        },
        (err) => {
          console.warn('Initial GPS fix notice:', err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 10000
        }
      );

      // Continuous high-precision watch
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.updateFromCoords(pos.coords, pos.timestamp);
        },
        (err) => {
          console.warn('GPS continuous watch notice:', err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2500,
          timeout: 15000
        }
      );
    }

    this.initCompass();
  }

  initCompass() {
    if (this.orientationListener) return;
    if (typeof window === 'undefined') return;

    if ('DeviceOrientationEvent' in window) {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().catch(() => {});
      }

      this.orientationEventName = ('ondeviceorientationabsolute' in window)
        ? 'deviceorientationabsolute'
        : 'deviceorientation';

      this.orientationListener = (e) => {
        if (this.isSimulated) return;

        const now = Date.now();
        // Priority 1: When moving at walking/running speed, GPS trajectory is physically ground truth.
        // Do not allow orientation sensor to overwrite GPS heading while moving.
        if (this.currentPosition.speed >= 0.8 && (now - this.lastGpsHeadingTime) < 3000) {
          return;
        }

        let heading = null;
        if (e.webkitCompassHeading != null) {
          // iOS Safari native compass heading
          heading = e.webkitCompassHeading;
        } else if (e.alpha != null) {
          // Compensation for device screen rotation (portrait vs landscape)
          const screenAngle = (window.screen && window.screen.orientation && window.screen.orientation.angle != null)
            ? window.screen.orientation.angle
            : (typeof window.orientation === 'number' ? window.orientation : 0);

          // If held upright in hand (pitch > 15 deg), use full 3D Euler tilt compensation
          if (e.beta != null && e.gamma != null && Math.abs(e.beta) > 15) {
            const aRad = (e.alpha * Math.PI) / 180;
            const bRad = (e.beta * Math.PI) / 180;
            const gRad = (e.gamma * Math.PI) / 180;

            const cA = Math.cos(aRad), sA = Math.sin(aRad);
            const cB = Math.cos(bRad), sB = Math.sin(bRad);
            const cG = Math.cos(gRad), sG = Math.sin(gRad);

            const rA = -cA * sG - sA * sB * cG;
            const rB = -sA * sG + cA * sB * cG;

            let deg = Math.atan2(rA, rB) * (180 / Math.PI);
            if (deg < 0) deg += 360;
            heading = (deg + screenAngle) % 360;
          } else {
            // Lying flat
            heading = (360 - e.alpha + screenAngle) % 360;
          }

          // On Android WebView / Capacitor apps, the hardware coordinate frame is inverted by 180°
          const isAndroid = Capacitor.isNativePlatform() || /Android/i.test(navigator.userAgent || '');
          if (isAndroid) {
            heading = (heading + 180) % 360;
          }
        }

        if (heading != null) {
          const rawTarget = Math.round(heading);
          const current = this.currentPosition.heading || 0;
          
          // Shortest angular distance interpolation to eliminate jitter and 180-degree jump glitch
          let diff = (rawTarget - current + 540) % 360 - 180;
          
          // Update if moved by >= 4 deg and rate limit to 100ms
          if (Math.abs(diff) >= 4 && (now - this.lastHeadingNotifyTime >= 100)) {
            const smoothed = Math.round((current + diff * 0.5 + 360) % 360);
            this.lastHeading = smoothed;
            this.lastHeadingNotifyTime = now;
            this.currentPosition.heading = smoothed;
            this.notify();
          }
        }
      };

      window.addEventListener(this.orientationEventName, this.orientationListener, true);
    }
  }

  stopTracking() {
    if (this.watchId != null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.capacitorWatchId != null) {
      try {
        Geolocation.clearWatch({ id: this.capacitorWatchId }).catch(() => {});
      } catch (e) {}
      this.capacitorWatchId = null;
    }
    if (this.orientationListener != null && typeof window !== 'undefined') {
      const eventName = this.orientationEventName || 'deviceorientation';
      window.removeEventListener(eventName, this.orientationListener, true);
      this.orientationListener = null;
    }
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback({ ...this.currentPosition });
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const data = { ...this.currentPosition };
    for (const cb of this.subscribers) {
      try {
        cb(data);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

export const geoService = new GeoService();
