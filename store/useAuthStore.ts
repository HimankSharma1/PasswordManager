import { create } from 'zustand';

interface AuthState {
  mek: Uint8Array | null;
  isUnlocked: boolean;
  biometricEnabled: boolean;
  ignoreAppBackground: boolean;
  setMEK: (key: Uint8Array) => void;
  lockVault: () => void;
  setBiometricEnabled: (enabled: boolean) => void;
  setIgnoreAppBackground: (ignore: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  mek: null,
  isUnlocked: false,
  biometricEnabled: false,
  ignoreAppBackground: false,
  setMEK: (key: Uint8Array) => set({ mek: key, isUnlocked: true }),
  lockVault: () => set({ mek: null, isUnlocked: false }),
  setBiometricEnabled: (enabled: boolean) => set({ biometricEnabled: enabled }),
  setIgnoreAppBackground: (ignore: boolean) => set({ ignoreAppBackground: ignore }),
}));
