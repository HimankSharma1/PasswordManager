import { useAlertStore, AlertButton } from '../store/useAlertStore';

export const CustomAlert = {
  alert: (title: string, message?: string, buttons?: AlertButton[]) => {
    // If no buttons are provided, default to a single 'OK' button like native Alert
    const defaultButtons: AlertButton[] = [{ text: 'OK' }];
    useAlertStore.getState().alert(title, message, buttons || defaultButtons);
  }
};
