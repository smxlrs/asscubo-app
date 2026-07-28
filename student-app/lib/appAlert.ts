import { showCustomAlert } from './customAlert';

type AppAlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

/**
 * Compatibility facade for legacy Alert.alert calls. Keeping this small lets
 * existing user flows share the app dialog treatment without changing actions.
 */
export const appAlert = {
  alert(title?: string, message?: string, buttons?: AppAlertButton[]) {
    showCustomAlert(title || '', message, buttons, {
      messageAlign: 'left',
      buttonPresentation: 'text',
      textButtonAlignment: buttons && buttons.length > 1 ? 'end' : 'end',
    });
  },
};
