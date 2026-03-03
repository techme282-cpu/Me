// Push notification permission and display helper
// Uses Capacitor LocalNotifications for Android APK, falls back to browser Notification API

let LocalNotifications: any = null;
let isCapacitor = false;

// Try to load Capacitor Local Notifications
async function initCapacitorNotifications() {
  try {
    const mod = await import("@capacitor/local-notifications");
    LocalNotifications = mod.LocalNotifications;
    isCapacitor = true;
  } catch {
    isCapacitor = false;
  }
}

// Initialize on load
initCapacitorNotifications();

let notifIdCounter = 1;

export async function requestNotificationPermission(): Promise<boolean> {
  // Try Capacitor first
  if (isCapacitor && LocalNotifications) {
    try {
      const result = await LocalNotifications.requestPermissions();
      return result.display === "granted";
    } catch {
      // Fall through to browser API
    }
  }

  // Browser fallback
  if (!("Notification" in window)) {
    console.log("Notifications not supported");
    return false;
  }
  
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  
  const result = await Notification.requestPermission();
  return result === "granted";
}

export async function showBrowserNotification(title: string, options?: {
  body?: string;
  icon?: string;
  tag?: string;
  data?: any;
}) {
  // Try Capacitor Local Notifications first (works on Android APK)
  if (isCapacitor && LocalNotifications) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        await LocalNotifications.requestPermissions();
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body: options?.body || "",
            id: notifIdCounter++,
            smallIcon: "ic_stat_icon_config_sample",
            iconColor: "#6366f1",
            sound: "default",
            channelId: "purgehub_notifications",
          },
        ],
      });

      // Also add a click handler
      LocalNotifications.addListener("localNotificationActionPerformed", () => {
        window.focus();
      });
      return;
    } catch (e) {
      console.log("Capacitor notification failed, falling back", e);
    }
  }

  // Browser fallback
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  
  try {
    const notification = new Notification(title, {
      body: options?.body || "",
      icon: options?.icon || "/favicon.ico",
      tag: options?.tag,
      data: options?.data,
      badge: "/favicon.ico",
    });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Fallback: some environments don't support Notification constructor
  }
}

// Create notification channel for Android (required for Android 8+)
export async function setupNotificationChannel() {
  if (!isCapacitor || !LocalNotifications) return;
  
  try {
    await LocalNotifications.createChannel({
      id: "purgehub_notifications",
      name: "Notifications Purge Hub",
      description: "Notifications de l'application Purge Hub",
      importance: 4, // HIGH
      visibility: 1, // PUBLIC
      sound: "default",
      vibration: true,
    });
  } catch (e) {
    console.log("Channel creation failed (may already exist):", e);
  }
}
