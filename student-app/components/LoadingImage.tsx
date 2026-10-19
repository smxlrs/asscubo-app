import React, { useState } from 'react';
import { ActivityIndicator, Image, ImageProps, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { imageLoadingMessages } from '../lib/imageLoading';

type Props = Pick<ImageProps, 'source' | 'style' | 'resizeMode'> & { backgroundColor?: string };

export function LoadingImage(props: Props) {
  // Remount the state when a recycled card receives a different image URL.
  const uri = typeof props.source === 'object' && !Array.isArray(props.source) ? props.source?.uri : props.source;
  return <ImageWithPlaceholder key={String(uri)} {...props} />;
}

function ImageWithPlaceholder({ source, style, resizeMode, backgroundColor }: Props) {
  const { colors, language } = useTheme();
  const labels = imageLoadingMessages[language];
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  return (
    <View style={[style, { overflow: 'hidden', backgroundColor: backgroundColor ?? colors.border }]}>
      <Image source={source} resizeMode={resizeMode} style={StyleSheet.absoluteFill}
        onLoad={() => setStatus('loaded')} onError={() => setStatus('failed')} />
      {status !== 'loaded' && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.placeholder]}
          accessible accessibilityLabel={status === 'loading' ? labels.loading : labels.failed}
          accessibilityState={{ busy: status === 'loading' }}>
          {status === 'loading' ? <ActivityIndicator color={colors.primary} /> :
            <Text style={[styles.failed, { color: colors.textSecondary }]}>{labels.failed}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  failed: { fontSize: 11, textAlign: 'center', padding: 4 },
});
