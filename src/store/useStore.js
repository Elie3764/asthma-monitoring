import { create } from 'zustand';

const useStore = create((set, get) => ({

  // ===== UTILISATEUR =====
  user:        null,
  userProfile: null,
  setUser:        (user)        => set({ user }),
  setUserProfile: (userProfile) => set({ userProfile }),

  // ===== THEME =====
  theme: 'dark',
  setTheme: (theme) => set({ theme }),

  // ===== VITAUX =====
  vitals: {
    spo2:0, hr:0, temp:0, hum:0,
    resp:0, lat:0, lng:0, gps:false, batt:100,
  },
  setVitals:   (vitals) => set({ vitals }),
  updateVital: (key, value) => set((s) => ({
    vitals: { ...s.vitals, [key]: value }
  })),

  // ===== ALERTES =====
  alertStatus: 'normal',
  activeAlerts: [],
  setAlertStatus: (alertStatus) => set({ alertStatus }),
  addAlert: (alert) => set((s) => ({
    activeAlerts: [alert, ...s.activeAlerts].slice(0, 20)
  })),
  clearAlerts: () => set({ activeAlerts: [], alertStatus: 'normal' }),

  // ===== MONTRE =====
  connectedDevice: null,
  connectionType:  null,
  setConnectedDevice: (connectedDevice) => set({ connectedDevice }),
  setConnectionType:  (connectionType)  => set({ connectionType }),

  // ===== NOTIFICATIONS =====
  notificationsEnabled: true,
  smsAlertsEnabled:     true,
  setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
  setSmsAlertsEnabled:     (v) => set({ smsAlertsEnabled: v }),

  // ===== MESSAGES CHAT =====
  messages: {},
  setMessages: (chatId, list) => set((s) => ({
    messages: { ...s.messages, [chatId]: list }
  })),
  appendMessage: (chatId, msg) => set((s) => ({
    messages: {
      ...s.messages,
      [chatId]: [...(s.messages[chatId] || []), msg]
    }
  })),

  // ===== PERSISTANCE (stub — pas de AsyncStorage requis) =====
  loadPersistedData: () => {
    // Rien a charger — Firebase gere la persistance
  },

  // ===== RESET =====
  reset: () => set({
    user:            null,
    userProfile:     null,
    vitals:          { spo2:0, hr:0, temp:0, hum:0, resp:0, lat:0, lng:0, gps:false, batt:100 },
    alertStatus:     'normal',
    activeAlerts:    [],
    connectedDevice: null,
    connectionType:  null,
    messages:        {},
  }),
}));

export { useStore };
export default useStore;
