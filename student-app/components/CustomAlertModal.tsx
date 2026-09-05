import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Animated, 
  Dimensions, 
  TouchableWithoutFeedback
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { customAlertManager, AlertButton, AlertIcon } from '../lib/customAlert';

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
        // Android Modal can leave a translucent window frame during exit animations.
        // Close it atomically so no gray afterimage remains after a button press.
        fadeAnim.stopAnimation();
        scaleAnim.stopAnimation();
        setVisible(false);
        setRenderedConfig(null);
      }
    });

    return unsubscribe;
  }, []);

  if (!renderedConfig) return null;

  const handleButtonPress = (button: AlertButton) => {
    customAlertManager.hide();
    if (button.onPress) {
      setTimeout(button.onPress, 0);
    }
  };

  const handleDismiss = () => {
    if (renderedConfig.options?.cancelable !== false) {
      customAlertManager.hide();
      renderedConfig.options?.onDismiss?.();
    }
  };

  const title = renderedConfig.title;
  const message = renderedConfig.message;
  const icon = renderedConfig.options?.icon as AlertIcon | undefined;
  const messageAlign = renderedConfig.options?.messageAlign ?? 'center';
  const textOnlyButtons = renderedConfig.options?.buttonPresentation === 'text';
  const textButtonAlignment = renderedConfig.options?.textButtonAlignment ?? 'split';
  
  // Default to a single localized confirm button if no buttons are provided
  const buttons: AlertButton[] = renderedConfig.buttons && renderedConfig.buttons.length > 0 
    ? renderedConfig.buttons 
    : [{ text: t('confirm'), style: 'default' }];

  const iconStyles: Record<AlertIcon, { name: string; color: string; backgroundColor: string }> = {
    update: { name: 'progress-download', color: colors.primary, backgroundColor: colors.primarySoft },
    success: { name: 'check', color: colors.success, backgroundColor: `${colors.success}18` },
    warning: { name: 'alert-circle-outline', color: colors.primary, backgroundColor: colors.primarySoft },
    error: { name: 'alert-circle-outline', color: colors.error, backgroundColor: `${colors.error}18` },
    info: { name: 'information-outline', color: colors.primary, backgroundColor: colors.primarySoft },
  };
  const currentIcon = icon ? iconStyles[icon] : null;



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
              {currentIcon ? (
                <View style={[styles.iconCircle, { backgroundColor: currentIcon.backgroundColor }]}>
                  <MaterialCommunityIcons name={currentIcon.name as any} size={23} color={currentIcon.color} />
                </View>
              ) : null}
              {/* Title */}
              {title ? (
                <Text style={[styles.titleText, { color: colors.textPrimary }]}>
                  {title}
                </Text>
              ) : null}

              {/* Message Description */}
              {message ? (
                <View style={styles.messageBlock}>
                  <Text style={[styles.messageText, { color: colors.textSecondary, textAlign: messageAlign, marginBottom: renderedConfig.options?.messageLink ? 4 : 18 }]}>{message}</Text>
                  {renderedConfig.options?.messageLink ? <TouchableOpacity onPress={() => { customAlertManager.hide(); setTimeout(() => renderedConfig.options.messageLink.onPress?.(), 0); }}><Text style={[styles.messageLink, { color: colors.primary }]}>{renderedConfig.options.messageLink.text}</Text></TouchableOpacity> : null}
                </View>
              ) : null}

              {/* Buttons Area */}
              <View style={[
                buttons.length <= 2 ? styles.buttonsRow : styles.buttonsColumn,
                buttons.length === 1 && styles.singleButtonRow,
                textOnlyButtons && styles.textButtonsRow,
                textOnlyButtons && textButtonAlignment === 'end' && styles.textButtonsEndAligned,
                buttons.length === 1 && textOnlyButtons && styles.singleTextButtonRow,
              ]}>
                {buttons.map((btn, index) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';
                  const isPrimary = !isCancel;
                  const buttonColor = colors.primary;
                  const buttonTextColor = isPrimary
                    ? (isDark ? '#F5F5F5' : colors.primary)
                    : colors.textSecondary;

                  const defaultText = isCancel ? t('cancel') : t('confirm');

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        buttons.length === 1
                          ? styles.singleButton
                          : !textOnlyButtons && styles.splitButton,
                        !textOnlyButtons && isPrimary
                          ? { backgroundColor: buttonColor, borderColor: buttonColor }
                          : !textOnlyButtons
                          ? { backgroundColor: 'transparent', borderColor: colors.border }
                          : styles.textOnlyButton,
                        textOnlyButtons && index === buttons.length - 1 && styles.trailingTextButton,
                      ]}
                      onPress={() => handleButtonPress(btn)}
                      activeOpacity={0.78}
                      hitSlop={textOnlyButtons ? { top: 8, right: 8, bottom: 8, left: 8 } : undefined}
                    >
                      <Text style={[
                        styles.buttonText,
                        { color: textOnlyButtons ? buttonTextColor : (isPrimary ? '#FFFFFF' : colors.textSecondary) },
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
    maxWidth: SCREEN_WIDTH > 400 ? 376 : SCREEN_WIDTH - 32,
    borderRadius: 20,
    // Text glyphs do not fill their line boxes. These values keep the visible
    // top and bottom whitespace visually aligned with the 24dp side padding.
    paddingTop: 20,
    paddingBottom: 13,
    paddingHorizontal: 24,
    alignItems: 'stretch',
    transform: [{ scale: 0.92 }], // Default scale to prevent first-frame scale flash
  },
  titleText: {
    fontSize: 19,
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 8,
    lineHeight: 27,
  },
  messageText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 23,
  },
  messageBlock: { marginBottom: 4 },
  messageLink: { fontSize: 13, textAlign: 'left', textDecorationLine: 'underline', marginBottom: 10 },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  buttonsColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 6,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  button: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splitButton: { flex: 1 },
  singleButton: { minWidth: 84 },
  singleButtonRow: { justifyContent: 'flex-end' },
  textButtonsRow: {
    justifyContent: 'space-between',
    gap: 0,
    marginTop: 12,
  },
  textButtonsEndAligned: { justifyContent: 'flex-end', gap: 32 },
  singleTextButtonRow: { justifyContent: 'flex-end' },
  textOnlyButton: {
    minHeight: 36,
    minWidth: 0,
    borderWidth: 0,
    paddingHorizontal: 0,
    transform: [{ translateY: 3 }],
  },
  // Compensates for the font's trailing and descender side bearings so the
  // visible action glyphs align with the 24dp content inset.
  trailingTextButton: { transform: [{ translateX: 3 }, { translateY: 3 }] },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
