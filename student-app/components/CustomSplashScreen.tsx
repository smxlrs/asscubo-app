import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Image, ActivityIndicator, Animated } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

interface CustomSplashScreenProps {
  visible: boolean;
  onAnimationComplete?: () => void;
}

export function CustomSplashScreen({ visible, onAnimationComplete }: CustomSplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    if (!visible) {
      // Start fade out and scale up animation when visible goes to false
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 350,
          useNativeDriver: true,
        })
      ]).start(() => {
        setShouldRender(false);
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      });
    }
  }, [visible]);

  // Hide the native splash screen as soon as our custom splash screen is mounted and rendered.
  // This ensures a seamless transition without flashing.
  useEffect(() => {
    const hideNativeSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn('Error hiding native splash screen:', e);
      }
    };
    hideNativeSplash();
  }, []);

  if (!shouldRender) {
    return null;
  }

  return (
    <Animated.View style={[
      styles.container, 
      { 
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }]
      }
    ]}>
      <View style={styles.content}>
        <Image
          source={require('../assets/icon.png')}
          style={styles.logo}
          resizeMode="cover"
        />
        <Text style={styles.title}>博学</Text>
        <ActivityIndicator 
          size="large" 
          color="#FFFFFF" 
          style={styles.loader} 
        />
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>博洛尼亚大学中国学联</Text>
        <Text style={styles.footerSubtext}>ASSCUBO</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#B8362C', // Matches app.json splash backgroundColor
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999, // Ensure it sits on top of everything
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  logo: {
    width: 110,
    height: 110,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    // iOS Shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    // Android Shadow
    elevation: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 20,
    letterSpacing: 4,
  },
  loader: {
    marginTop: 35,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '500',
    letterSpacing: 1.5,
  },
  footerSubtext: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 4,
    letterSpacing: 1,
  },
});
