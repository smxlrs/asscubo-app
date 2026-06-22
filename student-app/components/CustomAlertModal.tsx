import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Animated, 
  Dimensions, 
  Platform,
  TouchableWithoutFeedback
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { customAlertManager, AlertButton } from '../lib/customAlert';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function CustomAlertModal() {
  const { colors, isDark, t } = useTheme();
  const [renderedConfig, setRenderedConfig] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    const unsubscribe = customAlertManager.subscribe((newConfig) => {
      if (newConfig) {
        setRenderedConfig(newConfig);
        setVisible(true);
        
        // Reset animations to their initial values to avoid first-frame native driver layout flash
        fadeAnim.setValue(0);
        scaleAnim.setValue(0.92);
        
        // Start showing animations
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 7,
            tension: 50,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        // Start hiding animations
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.94,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setVisible(false);
        });
      }
    });

    return unsubscribe;
  }, []);

  if (!renderedConfig) return null;

  const handleButtonPress = (button: AlertButton) => {
    // Hide first
    customAlertManager.hide();
    
    // Execute callback after animations finish (delayed slightly)
    if (button.onPress) {
      setTimeout(() => {
        button.onPress?.();
      }, 150);
    }
  };

  const handleDismiss = () => {
    if (renderedConfig.options?.cancelable !== false) {
      customAlertManager.hide();
      if (renderedConfig.options?.onDismiss) {
        setTimeout(() => {
          renderedConfig.options.onDismiss();
        }, 150);
      }
    }
  };

  const title = renderedConfig.title;
  const message = renderedConfig.message;
  
  // Default to a single localized confirm button if no buttons are provided
  const buttons: AlertButton[] = renderedConfig.buttons && renderedConfig.buttons.length > 0 
    ? renderedConfig.buttons 
    : [{ text: t('confirm'), style: 'default' }];



  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent={true}
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View 
              style={[
                styles.alertCard, 
                { 
                  backgroundColor: colors.surfaceElevated || (isDark ? '#1C1C1C' : '#FFFFFF'),
                  borderColor: colors.border,
                  transform: [{ scale: scaleAnim }]
                }
              ]}
            >
              {/* Title */}
              {title ? (
                <Text style={[styles.titleText, { color: colors.textPrimary }]}>
                  {title}
                </Text>
              ) : null}

              {/* Message Description */}
              {message ? (
                <Text style={[styles.messageText, { color: colors.textSecondary }]}>
                  {message}
                </Text>
              ) : null}

              {/* Buttons Area */}
              <View style={buttons.length <= 2 ? styles.buttonsRow : styles.buttonsColumn}>
                {buttons.map((btn, index) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';
                  
                  // OK/Confirm is primary red, cancel is secondary, destructive is red/orange
                  let btnTextColor = colors.primary;
                  if (isCancel) {
                    btnTextColor = colors.textSecondary;
                  } else if (isDestructive) {
                    btnTextColor = colors.error || '#EF4444';
                  }

                  const defaultText = isCancel ? t('cancel') : t('confirm');

                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.textButton}
                      onPress={() => handleButtonPress(btn)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.textButtonText, 
                        { 
                          color: btnTextColor, 
                          fontWeight: isCancel ? 'normal' : 'bold' 
                        }
                      ]}>
                        {btn.text || defaultText}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    opacity: 0, // Default to 0 to prevent first-frame flash on open
  },
  alertCard: {
    width: '100%',
    maxWidth: SCREEN_WIDTH > 400 ? 330 : SCREEN_WIDTH - 48,
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 24,
    borderWidth: 1,
    alignItems: 'stretch',
    transform: [{ scale: 0.92 }], // Default scale to prevent first-frame scale flash
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  titleText: {
    fontSize: 19,
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 10,
    lineHeight: 25,
  },
  messageText: {
    fontSize: 15,
    textAlign: 'left',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  buttonsColumn: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
  },
  textButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
