// Capacitor & Web Vibration API wrapper for tactile feedback
export const haptics = {
  // Light tick for UI clicks
  tick() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
  },

  // Strong pulse for tag confirmation
  tagImpact() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([80, 50, 120]);
    }
  },

  // Danger alarm rhythm (Hunter closing in)
  dangerAlert() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 70, 100, 70, 200]);
    }
  },

  // Radar ping pulse
  radarPulse() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 30, 40]);
    }
  }
};
