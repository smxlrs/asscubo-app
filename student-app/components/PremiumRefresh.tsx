import React, { useRef, useState, useEffect } from 'react';
import {
  ScrollView,
  FlatList,
  View,
  Text,
  Animated,
  StyleSheet,
  ScrollViewProps,
  FlatListProps,
  Easing,
  PanResponder,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export interface PremiumRefreshProps {
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
  topInset?: number;
}

export type PremiumScrollViewProps = ScrollViewProps & PremiumRefreshProps;
export type PremiumFlatListProps<T> = FlatListProps<T> & PremiumRefreshProps;

type RefreshState = 'idle' | 'pulling' | 'refreshing' | 'success';

function RefreshHeader({
  pullAnim,
  refreshState,
  colors,
  topInset = 0,
}: {
  pullAnim: Animated.Value;
  refreshState: RefreshState;
  colors: any;
  topInset?: number;
}) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const spinAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Spin animation loop during refreshing
  useEffect(() => {
    if (refreshState === 'refreshing') {
      successAnim.setValue(0);
      spinAnim.setValue(0);
      spinAnimationRef.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      );
      spinAnimationRef.current.start();
    } else {
      if (spinAnimationRef.current) {
        spinAnimationRef.current.stop();
        spinAnimationRef.current = null;
      }
    }
  }, [refreshState]);

  // Success animation morph
  useEffect(() => {
    if (refreshState === 'success') {
      Animated.spring(successAnim, {
        toValue: 1,
        tension: 80,
        friction: 6,
        useNativeDriver: false,
      }).start();
    } else if (refreshState === 'idle') {
      successAnim.setValue(0);
    }
  }, [refreshState]);

  // Interpolate rotation for pull-to-refresh
  const pullRotation = pullAnim.interpolate({
    inputRange: [0, 80],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'clamp',
  });

  const spinRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const rotation = refreshState === 'refreshing' ? spinRotation : pullRotation;

  // Fade and scale interpolations for morphing
  const arrowScale = successAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [1, 0, 0],
  });

  const arrowOpacity = successAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [1, 0, 0],
  });

  const checkOpacity = successAnim.interpolate({
    inputRange: [0, 0.1, 1],
    outputRange: [0, 1, 1],
  });

  // Stroke animations for drawing checkmark sequential strokes
  const leftScale = successAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 1, 1],
  });

  const leftTranslateY = leftScale.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, 0],
  });

  const rightScale = successAnim.interpolate({
    inputRange: [0, 0.4, 0.9, 1],
    outputRange: [0, 0, 1, 1],
  });

  const rightTranslateY = rightScale.interpolate({
    inputRange: [0, 1],
    outputRange: [7, 0],
  });

  // Border color morphing (Background is always white surface)
  const circleBorderColor = successAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  // Header fade-in and scale-down
  const headerOpacity = pullAnim.interpolate({
    inputRange: [0, 40, 80],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const headerScale = pullAnim.interpolate({
    inputRange: [0, 80],
    outputRange: [0.6, 1],
    extrapolate: 'clamp',
  });

  // Translate header down from offscreen to top of view
  const headerTranslateY = pullAnim.interpolate({
    inputRange: [0, 60, 100],
    outputRange: [-50 + topInset, 15 + topInset, 35 + topInset],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.refreshHeader,
        {
          opacity: refreshState === 'success' || refreshState === 'refreshing' ? 1 : headerOpacity,
          transform: [
            { translateY: headerTranslateY },
            { scale: refreshState === 'success' || refreshState === 'refreshing' ? 1 : headerScale },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.refreshCircle,
          {
            backgroundColor: colors.surface,
            borderColor: circleBorderColor,
          },
        ]}
      >
        {/* Spinner arrow */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.centered,
            {
              opacity: arrowOpacity,
              transform: [{ rotate: rotation }, { scale: arrowScale }],
            },
          ]}
        >
          <MaterialCommunityIcons name="refresh" size={24} color={colors.primary} />
        </Animated.View>

        {/* Success Checkmark (Stroke-by-stroke drawing animation) */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.centered,
            {
              opacity: checkOpacity,
            },
          ]}
        >
          <View style={styles.checkmarkContainer}>
            {/* Left stroke of checkmark */}
            <Animated.View
              style={[
                styles.checkmarkStroke,
                {
                  height: 8,
                  left: 5,
                  top: 11,
                  backgroundColor: colors.primary,
                  transform: [
                    { rotate: '-45deg' },
                    { translateY: leftTranslateY },
                    { scaleY: leftScale },
                  ],
                },
              ]}
            />
            {/* Right stroke of checkmark */}
            <Animated.View
              style={[
                styles.checkmarkStroke,
                {
                  height: 14,
                  left: 12,
                  top: 6,
                  backgroundColor: colors.primary,
                  transform: [
                    { rotate: '45deg' },
                    { translateY: rightTranslateY },
                    { scaleY: rightScale },
                  ],
                },
              ]}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

export const PremiumScrollView = React.forwardRef<ScrollView, PremiumScrollViewProps>(
  ({ refreshing, onRefresh, children, topInset, ...props }, ref) => {
    const { colors } = useTheme();
    const pullAnim = useRef(new Animated.Value(0)).current;
    const [refreshState, setRefreshState] = useState<RefreshState>('idle');
    const scrollOffsetRef = useRef(0);
    const pullDistanceRef = useRef(0);

    useEffect(() => {
      const listenerId = pullAnim.addListener(({ value }) => {
        pullDistanceRef.current = value;
      });
      return () => {
        pullAnim.removeListener(listenerId);
      };
    }, []);

    useEffect(() => {
      if (refreshing) {
        setRefreshState('refreshing');
      } else if (refreshState === 'refreshing') {
        setRefreshState('success');
        setTimeout(() => {
          Animated.spring(pullAnim, {
            toValue: 0,
            useNativeDriver: false,
            tension: 30,
            friction: 8,
          }).start(() => {
            setRefreshState('idle');
          });
        }, 800);
      }
    }, [refreshing]);

    const handleScroll = (e: any) => {
      scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
      if (props.onScroll) {
        props.onScroll(e);
      }
    };

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          // Only intercept when at the top and pulling down
          const isAtTop = scrollOffsetRef.current <= 2;
          const isPullingDown = gestureState.dy > 5;
          const isStateAllowsPull = refreshState === 'idle' || refreshState === 'pulling';
          return isAtTop && isPullingDown && isStateAllowsPull;
        },
        onPanResponderGrant: () => {
          setRefreshState('pulling');
        },
        onPanResponderMove: (evt, gestureState) => {
          // Apply drag resistance
          const pullDistance = Math.min(100, gestureState.dy * 0.45);
          pullAnim.setValue(pullDistance);
        },
        onPanResponderRelease: () => {
          const currentPull = pullDistanceRef.current;
          if (currentPull >= 60) {
            Animated.spring(pullAnim, {
              toValue: 60,
              useNativeDriver: false,
              tension: 40,
              friction: 7,
            }).start();
            setRefreshState('refreshing');
            onRefresh();
          } else {
            Animated.spring(pullAnim, {
              toValue: 0,
              useNativeDriver: false,
              tension: 40,
              friction: 7,
            }).start(() => {
              setRefreshState('idle');
            });
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(pullAnim, {
            toValue: 0,
            useNativeDriver: false,
            tension: 40,
            friction: 7,
          }).start(() => {
            setRefreshState('idle');
          });
        },
      })
    ).current;

    return (
      <View style={styles.container} {...panResponder.panHandlers}>
        <RefreshHeader pullAnim={pullAnim} refreshState={refreshState} colors={colors} topInset={topInset} />
        <ScrollView
          ref={ref}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          {...props}
        >
          {children}
        </ScrollView>
      </View>
    );
  }
);

export const PremiumFlatList = React.forwardRef<FlatList, PremiumFlatListProps<any>>(
  ({ refreshing, onRefresh, topInset, ...props }, ref) => {
    const { colors } = useTheme();
    const pullAnim = useRef(new Animated.Value(0)).current;
    const [refreshState, setRefreshState] = useState<RefreshState>('idle');
    const scrollOffsetRef = useRef(0);
    const pullDistanceRef = useRef(0);

    useEffect(() => {
      const listenerId = pullAnim.addListener(({ value }) => {
        pullDistanceRef.current = value;
      });
      return () => {
        pullAnim.removeListener(listenerId);
      };
    }, []);

    useEffect(() => {
      if (refreshing) {
        setRefreshState('refreshing');
      } else if (refreshState === 'refreshing') {
        setRefreshState('success');
        setTimeout(() => {
          Animated.spring(pullAnim, {
            toValue: 0,
            useNativeDriver: false,
            tension: 30,
            friction: 8,
          }).start(() => {
            setRefreshState('idle');
          });
        }, 800);
      }
    }, [refreshing]);

    const handleScroll = (e: any) => {
      scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
      if (props.onScroll) {
        props.onScroll(e);
      }
    };

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          const isAtTop = scrollOffsetRef.current <= 2;
          const isPullingDown = gestureState.dy > 5;
          const isStateAllowsPull = refreshState === 'idle' || refreshState === 'pulling';
          return isAtTop && isPullingDown && isStateAllowsPull;
        },
        onPanResponderGrant: () => {
          setRefreshState('pulling');
        },
        onPanResponderMove: (evt, gestureState) => {
          const pullDistance = Math.min(100, gestureState.dy * 0.45);
          pullAnim.setValue(pullDistance);
        },
        onPanResponderRelease: () => {
          const currentPull = pullDistanceRef.current;
          if (currentPull >= 60) {
            Animated.spring(pullAnim, {
              toValue: 60,
              useNativeDriver: false,
              tension: 40,
              friction: 7,
            }).start();
            setRefreshState('refreshing');
            onRefresh();
          } else {
            Animated.spring(pullAnim, {
              toValue: 0,
              useNativeDriver: false,
              tension: 40,
              friction: 7,
            }).start(() => {
              setRefreshState('idle');
            });
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(pullAnim, {
            toValue: 0,
            useNativeDriver: false,
            tension: 40,
            friction: 7,
          }).start(() => {
            setRefreshState('idle');
          });
        },
      })
    ).current;

    return (
      <View style={styles.container} {...panResponder.panHandlers}>
        <RefreshHeader pullAnim={pullAnim} refreshState={refreshState} colors={colors} topInset={topInset} />
        <FlatList
          ref={ref}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          {...props}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  refreshHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  refreshCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkContainer: {
    width: 24,
    height: 24,
    position: 'relative',
  },
  checkmarkStroke: {
    position: 'absolute',
    width: 3,
    borderRadius: 1.5,
  },
});
