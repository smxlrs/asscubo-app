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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export interface PremiumRefreshProps {
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
}

export type PremiumScrollViewProps = ScrollViewProps & PremiumRefreshProps;
export type PremiumFlatListProps<T> = FlatListProps<T> & PremiumRefreshProps;

type RefreshState = 'idle' | 'pulling' | 'refreshing' | 'success';

function RefreshHeader({
  pullAnim,
  refreshState,
  colors,
}: {
  pullAnim: Animated.Value;
  refreshState: RefreshState;
  colors: any;
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
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const arrowOpacity = successAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });

  const checkScale = successAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });

  const checkOpacity = successAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 1],
  });

  // Background and border color morphing
  const circleBgColor = successAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surfaceElevated, colors.success],
  });

  const circleBorderColor = successAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.success],
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

  return (
    <Animated.View
      style={[
        styles.refreshHeader,
        {
          opacity: refreshState === 'success' || refreshState === 'refreshing' ? 1 : headerOpacity,
          transform: [
            { scale: refreshState === 'success' || refreshState === 'refreshing' ? 1 : headerScale },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.refreshCircle,
          {
            backgroundColor: circleBgColor,
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
          <MaterialCommunityIcons name="loading" size={24} color={colors.primary} />
        </Animated.View>

        {/* Success Checkmark */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.centered,
            {
              opacity: checkOpacity,
              transform: [{ scale: checkScale }],
            },
          ]}
        >
          <MaterialCommunityIcons name="check" size={24} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

export const PremiumScrollView = React.forwardRef<ScrollView, PremiumScrollViewProps>(
  ({ refreshing, onRefresh, children, ...props }, ref) => {
    const { colors } = useTheme();
    const pullAnim = useRef(new Animated.Value(0)).current;
    const [refreshState, setRefreshState] = useState<RefreshState>('idle');
    const scrollOffsetRef = useRef(0);
    const touchStartY = useRef(0);
    const isPulling = useRef(false);

    useEffect(() => {
      if (refreshing) {
        setRefreshState('refreshing');
      } else if (refreshState === 'refreshing') {
        setRefreshState('success');
        setTimeout(() => {
          Animated.spring(pullAnim, {
            toValue: 0,
            useNativeDriver: true,
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

    const handleTouchStart = (e: any) => {
      touchStartY.current = e.nativeEvent.pageY;
      if (props.onTouchStart) {
        props.onTouchStart(e);
      }
    };

    const handleTouchMove = (e: any) => {
      const currentY = e.nativeEvent.pageY;
      const dy = currentY - touchStartY.current;

      if (scrollOffsetRef.current <= 1 && dy > 0 && refreshState !== 'refreshing' && refreshState !== 'success') {
        isPulling.current = true;
        setRefreshState('pulling');
        // Drag resistance
        const pullDistance = Math.min(100, dy * 0.45);
        pullAnim.setValue(pullDistance);
      }
      if (props.onTouchMove) {
        props.onTouchMove(e);
      }
    };

    const handleTouchEnd = (e: any) => {
      if (isPulling.current) {
        isPulling.current = false;
        // @ts-ignore
        const currentPull = pullAnim._value || 0;
        if (currentPull >= 60) {
          Animated.spring(pullAnim, {
            toValue: 60,
            useNativeDriver: true,
            tension: 40,
            friction: 7,
          }).start();
          setRefreshState('refreshing');
          onRefresh();
        } else {
          Animated.spring(pullAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 7,
          }).start(() => {
            setRefreshState('idle');
          });
        }
      }
      if (props.onTouchEnd) {
        props.onTouchEnd(e);
      }
    };

    return (
      <View style={styles.container}>
        <RefreshHeader pullAnim={pullAnim} refreshState={refreshState} colors={colors} />
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY: pullAnim }],
            },
          ]}
        >
          <ScrollView
            ref={ref}
            scrollEventThrottle={16}
            onScroll={handleScroll}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            {...props}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    );
  }
);

export const PremiumFlatList = React.forwardRef<FlatList, PremiumFlatListProps<any>>(
  ({ refreshing, onRefresh, ...props }, ref) => {
    const { colors } = useTheme();
    const pullAnim = useRef(new Animated.Value(0)).current;
    const [refreshState, setRefreshState] = useState<RefreshState>('idle');
    const scrollOffsetRef = useRef(0);
    const touchStartY = useRef(0);
    const isPulling = useRef(false);

    useEffect(() => {
      if (refreshing) {
        setRefreshState('refreshing');
      } else if (refreshState === 'refreshing') {
        setRefreshState('success');
        setTimeout(() => {
          Animated.spring(pullAnim, {
            toValue: 0,
            useNativeDriver: true,
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

    const handleTouchStart = (e: any) => {
      touchStartY.current = e.nativeEvent.pageY;
      if (props.onTouchStart) {
        props.onTouchStart(e);
      }
    };

    const handleTouchMove = (e: any) => {
      const currentY = e.nativeEvent.pageY;
      const dy = currentY - touchStartY.current;

      if (scrollOffsetRef.current <= 1 && dy > 0 && refreshState !== 'refreshing' && refreshState !== 'success') {
        isPulling.current = true;
        setRefreshState('pulling');
        const pullDistance = Math.min(100, dy * 0.45);
        pullAnim.setValue(pullDistance);
      }
      if (props.onTouchMove) {
        props.onTouchMove(e);
      }
    };

    const handleTouchEnd = (e: any) => {
      if (isPulling.current) {
        isPulling.current = false;
        // @ts-ignore
        const currentPull = pullAnim._value || 0;
        if (currentPull >= 60) {
          Animated.spring(pullAnim, {
            toValue: 60,
            useNativeDriver: true,
            tension: 40,
            friction: 7,
          }).start();
          setRefreshState('refreshing');
          onRefresh();
        } else {
          Animated.spring(pullAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 7,
          }).start(() => {
            setRefreshState('idle');
          });
        }
      }
      if (props.onTouchEnd) {
        props.onTouchEnd(e);
      }
    };

    return (
      <View style={styles.container}>
        <RefreshHeader pullAnim={pullAnim} refreshState={refreshState} colors={colors} />
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY: pullAnim }],
            },
          ]}
        >
          <FlatList
            ref={ref}
            scrollEventThrottle={16}
            onScroll={handleScroll}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            {...props}
          />
        </Animated.View>
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
    top: 10,
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
});
