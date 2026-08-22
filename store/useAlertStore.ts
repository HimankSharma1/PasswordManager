import { create } from 'zustand';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
  alert: (title: string, message?: string, buttons?: AlertButton[]) => void;
  hide: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  visible: false,
  title: '',
  message: '',
  buttons: [],
  alert: (title, message = '', buttons = [{ text: 'OK' }]) => 
    set({ visible: true, title, message, buttons }),
  hide: () => set({ visible: false, title: '', message: '', buttons: [] }),
}));
