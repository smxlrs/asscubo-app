import { Alert, Platform } from 'react-native';

export type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertIcon = 'update' | 'success' | 'warning' | 'error' | 'info';

export type AlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
  icon?: AlertIcon;
  messageAlign?: 'left' | 'center';
  buttonPresentation?: 'filled' | 'text';
  textButtonAlignment?: 'split' | 'end';
  messageLink?: { text: string; onPress?: () => void };
};

type AlertConfig = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
};

type AlertListener = (config: AlertConfig | null) => void;

class CustomAlertManager {
  private listener: AlertListener | null = null;

  subscribe(listener: AlertListener) {
    this.listener = listener;
    return () => {
      if (this.listener === listener) {
        this.listener = null;
      }
    };
  }

  show(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    if (Platform.OS === 'ios') {
      // React Native's iOS Alert uses its own alert window; it can safely appear
      // over a form Modal without presenting a second sibling RCTModalHostView.
      const actions = buttons?.length ? [...buttons] : [{ text: 'OK' }];
      if (options?.messageLink) actions.push({ text: options.messageLink.text, onPress: options.messageLink.onPress });
      Alert.alert(title, message, actions, { cancelable: options?.cancelable, onDismiss: options?.onDismiss });
      return;
    }
    if (this.listener) {
      this.listener({ title, message, buttons, options });
    }
  }

  hide() {
    if (this.listener) {
      this.listener(null);
    }
  }
}

export const customAlertManager = new CustomAlertManager();

export function showCustomAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
) {
  customAlertManager.show(title, message, buttons, options);
}
