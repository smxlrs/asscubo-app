export type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
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
