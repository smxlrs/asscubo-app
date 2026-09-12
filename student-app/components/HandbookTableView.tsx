import React, { useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { HandbookTable } from '../lib/handbookTable';

export function HandbookTableView({ table, fontSize, color, borderColor, surfaceColor, renderInline }: {
  table: HandbookTable; fontSize: number; color: string; borderColor: string; surfaceColor: string;
  renderInline: (text: string) => React.ReactNode;
}) {
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const available = measuredWidth || Math.max(200, width - 48);
  const columnWidth = Math.ceil(fontSize * 5 * Math.max(1, fontScale) + 20);
  const scrollable = columnWidth * table.headers.length > available + 1;
  return <View onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)} style={{ marginVertical: 12 }}>
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={scrollable}>
      <View style={{ borderTopWidth: 1, borderLeftWidth: 1, borderColor }}>
        {[table.headers, ...table.rows].map((row, r) => <View key={r} style={{ flexDirection: 'row', backgroundColor: r === 0 ? surfaceColor : undefined }}>
          {row.map((cell, c) => {
            const nextCell = r < table.rows.length ? table.rows[r]?.[c] : undefined;
            const continuesIntoNextRow = r > 0 && nextCell !== undefined && nextCell.trim() === '';
            return <View key={c} style={{ width: columnWidth, padding: 10, borderRightWidth: 1, borderBottomWidth: continuesIntoNextRow ? 0 : 1, borderColor }}>
            <Text selectable accessibilityRole={r === 0 ? 'header' : undefined}
              style={{ color, fontSize, lineHeight: fontSize * 1.5, fontWeight: r === 0 ? '700' : '400' }}>{renderInline(cell)}</Text>
          </View>})}
        </View>)}
      </View>
    </ScrollView>
    {scrollable && <Text style={{ color, opacity: 0.65, fontSize: 12, marginTop: 6 }}>左右滑动查看表格</Text>}
  </View>;
}
