import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { MarqueeText } from '../MarqueeText';
import {
  getOperatorInfo,
  normalizeTrainCategory,
  normalizeTrainNumber,
} from '../../lib/viaggiaTrenoService';

type TrainIdentityVariant = 'summary' | 'compact';

interface TrainIdentityProps {
  trainNumber: string | number | null | undefined;
  category?: string | null;
  codiceCliente?: string | number | null;
  variant?: TrainIdentityVariant;
  isHighSpeed?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function TrainIdentity({
  trainNumber,
  category,
  codiceCliente,
  variant = 'compact',
  isHighSpeed = false,
  style,
}: TrainIdentityProps) {
  const { colors } = useTheme();
  const normalizedNumber = normalizeTrainNumber(trainNumber) || '--';
  const normalizedCategory = normalizeTrainCategory(category);
  const operator = getOperatorInfo(codiceCliente ?? null, normalizedCategory);
  const shouldScrollNumber = Array.from(normalizedNumber).length > 6;

  if (variant === 'summary') {
    const badgeColor = isHighSpeed ? '#E30613' : colors.primary;
    const badgeBackground = isHighSpeed ? '#E3061320' : colors.primarySoft;

    return (
      <View style={[styles.row, styles.summaryRow, style]}>
        {normalizedCategory ? (
          <View style={[styles.summaryCategoryBadge, { backgroundColor: badgeBackground }]}>
            <Text style={[styles.summaryCategoryText, { color: badgeColor }]}>{normalizedCategory}</Text>
          </View>
        ) : null}
        {shouldScrollNumber ? (
          <View style={styles.summaryNumberViewport}>
            <MarqueeText
              text={normalizedNumber}
              style={[styles.summaryNumber, { color: colors.textPrimary }]}
            />
          </View>
        ) : (
          <Text numberOfLines={1} style={[styles.summaryNumber, styles.summaryNumberSpacing, { color: colors.textPrimary }]}>
            {normalizedNumber}
          </Text>
        )}
        <View style={[styles.operatorNameBadge, { borderColor: operator.color, backgroundColor: `${operator.color}10` }]}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.operatorNameText, { color: operator.color }]}>
            {operator.name}
          </Text>
        </View>
      </View>
    );
  }

  const showCategory = normalizedCategory && normalizedCategory.toUpperCase() !== operator.code.toUpperCase();

  return (
    <View style={[styles.row, styles.compactRow, style]}>
      <View style={[styles.operatorCodeBadge, { borderColor: operator.color, backgroundColor: `${operator.color}10` }]}>
        <Text style={[styles.operatorCodeText, { color: operator.color }]}>{operator.code}</Text>
      </View>
      {showCategory ? (
        <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.compactCategory, { color: colors.textPrimary }]}>
          {normalizedCategory}
        </Text>
      ) : null}
      {shouldScrollNumber ? (
        <View style={styles.compactNumberViewport}>
          <MarqueeText
            text={normalizedNumber}
            style={[styles.compactNumber, { color: colors.textPrimary }]}
          />
        </View>
      ) : (
        <Text numberOfLines={1} style={[styles.compactNumber, { color: colors.textPrimary }]}>
          {normalizedNumber}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    maxWidth: '100%',
  },
  summaryRow: {
    flexShrink: 0,
  },
  summaryCategoryBadge: {
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  summaryCategoryText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  summaryNumber: {
    fontSize: 15,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  summaryNumberSpacing: {
    flexShrink: 0,
    marginRight: 8,
  },
  summaryNumberViewport: {
    width: 57,
    flexShrink: 0,
    marginRight: 8,
    overflow: 'hidden',
  },
  operatorNameBadge: {
    minWidth: 0,
    maxWidth: 120,
    flexShrink: 1,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  operatorNameText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  compactRow: {
    flexShrink: 1,
  },
  operatorCodeBadge: {
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 8,
  },
  operatorCodeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  compactCategory: {
    minWidth: 0,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: 'bold',
    marginRight: 4,
  },
  compactNumber: {
    fontSize: 13,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  compactNumberViewport: {
    width: 49,
    flexShrink: 0,
    overflow: 'hidden',
  },
});
