import React, { useState, useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, StyleProp, TextStyle } from 'react-native';

interface MarqueeTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
}

export const MarqueeText: React.FC<MarqueeTextProps> = ({ text, style }) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    scrollAnim.setValue(0);
    if (animationRef.current) {
      animationRef.current.stop();
    }

    // Only scroll if the text is wider than the container
    if (textWidth > containerWidth && containerWidth > 0) {
      const scrollDistance = textWidth - containerWidth;
      // Scroll speed: approx 35px per second. Max 10s, min 3s
      const duration = Math.max(3000, Math.min(10000, scrollDistance * 30));

      const startAnimation = () => {
        scrollAnim.setValue(0);

        animationRef.current = Animated.sequence([
          // Stay at the start for 2 seconds
          Animated.delay(2000),
          // Scroll to the end
          Animated.timing(scrollAnim, {
            toValue: -scrollDistance,
            duration: duration,
            useNativeDriver: true,
          }),
          // Stay at the end for 2 seconds
          Animated.delay(2000),
        ]);

        animationRef.current.start((result) => {
          if (result.finished) {
            startAnimation();
          }
        });
      };

      startAnimation();
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [text, containerWidth, textWidth]);

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Invisible measurement text (unbounded layout) */}
      <View style={{ position: 'absolute', opacity: 0, width: 9999, flexDirection: 'row' }}>
        <Text
          style={[style, { flexShrink: 0, flexGrow: 0 }]}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
          numberOfLines={1}
        >
          {text}
        </Text>
      </View>

      {/* Render text with translation animation */}
      <Animated.View
        style={{
          transform: [{ translateX: scrollAnim }],
          width: textWidth > 0 ? textWidth : '100%',
        }}
      >
        <Text style={style} numberOfLines={1}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    width: '100%',
  },
  hiddenText: {
    position: 'absolute',
    opacity: 0,
    alignSelf: 'flex-start',
  },
});
