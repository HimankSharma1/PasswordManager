import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export type ThemeType = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'system',
  setTheme: (theme: ThemeType) => {
    set({ theme });
    SecureStore.setItemAsync('app_theme', theme).catch(() => {});
  },
  loadTheme: async () => {
    try {
      const savedTheme = await SecureStore.getItemAsync('app_theme');
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
        set({ theme: savedTheme as ThemeType });
      }
    } catch (e) {}
  }
}));
