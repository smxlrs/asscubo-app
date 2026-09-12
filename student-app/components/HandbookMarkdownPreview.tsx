import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { parseHandbookTable } from '../lib/handbookTable';
import { HANDBOOK_TEXT_BREAK_PROPS, hyphenateHandbookText, normalizeHandbookSoftBreaks } from '../lib/handbookTypography';
import { HandbookTableView } from './HandbookTableView';

function renderInline(text: string, color: string): React.ReactNode {
  const tokens = /\*\*\*([^*\n]+)\*\*\*|\*\*([^\n]+?)\*\*|\*([^*\n]+)\*|~~([^\n]+?)~~|`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\n]+)\)/g;
  const nodes: React.ReactNode[] = [];
  let offset = 0;
  let match: RegExpExecArray | null;
  while ((match = tokens.exec(text))) {
    if (match.index > offset) nodes.push(hyphenateHandbookText(text.slice(offset, match.index)));
    const [, both, bold, italic, strike, code, label] = match;
    nodes.push(<Text key={match.index} style={{
      color: label !== undefined ? '#3B82F6' : color,
      fontWeight: both !== undefined || bold !== undefined ? '700' : undefined,
      fontStyle: both !== undefined || italic !== undefined ? 'italic' : undefined,
      textDecorationLine: label !== undefined ? 'underline' : strike !== undefined ? 'line-through' : undefined,
      fontFamily: code !== undefined ? 'monospace' : undefined,
    }}>{code ?? hyphenateHandbookText(label ?? both ?? bold ?? italic ?? strike ?? '')}</Text>);
    offset = tokens.lastIndex;
  }
  if (offset < text.length) nodes.push(hyphenateHandbookText(text.slice(offset)));
  return nodes.length ? nodes : hyphenateHandbookText(text);
}

export function HandbookMarkdownPreview({ value }: { value: string }) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const fontSize = 18;

  const renderBlocks = (markdown: string, keyPrefix: string) => markdown.split(/\n\s*\n/).map((raw, index) => {
    const block = raw.trimEnd();
    if (!block.trim()) return null;
    const key = `${keyPrefix}-${index}`;
    const table = parseHandbookTable(block);
    if (table) return <HandbookTableView key={key} table={table} fontSize={fontSize} color={colors.textPrimary}
      borderColor={colors.border} surfaceColor={colors.surfaceElevated} renderInline={text => renderInline(text, colors.textPrimary)} />;
    if (/^---+$/.test(block)) return <View key={key} style={{ height: 1, backgroundColor: colors.border, marginVertical: 18 }} />;
    const heading = block.match(/^(#{1,3})\s+([^\n]+)(?:\n([\s\S]*))?$/);
    if (heading) {
      const level = heading[1].length;
      return <View key={key}><Text style={{ color: colors.textPrimary, fontSize: level === 1 ? 29 : level === 2 ? 25 : 22, fontWeight: '700', marginVertical: 8 }}>
        {renderInline(heading[2], colors.textPrimary)}</Text>{heading[3] ? renderBlocks(heading[3], `${key}-rest`) : null}</View>;
    }
    if (block.split('\n').every(line => line.startsWith('> '))) return <View key={key} style={{ borderLeftWidth: 3, borderColor: colors.border, paddingLeft: 12, marginVertical: 8 }}>
      <Text {...HANDBOOK_TEXT_BREAK_PROPS} style={{ color: colors.textPrimary, fontSize, lineHeight: 31, textAlign: 'left' }}>{renderInline(normalizeHandbookSoftBreaks(block.replace(/^> /gm, '')), colors.textPrimary)}</Text></View>;
    const lines = block.split('\n');
    if (lines.every(line => /^\s*(?:- |\d+\.\s)/.test(line))) return <View key={key} style={{ marginVertical: 5 }}>{lines.map((line, lineIndex) => {
      const ordered = line.trim().match(/^(\d+\.)\s+(.*)$/);
      const content = ordered ? ordered[2] : line.trim().replace(/^-\s+/, '');
      return <View key={lineIndex} style={{ flexDirection: 'row', marginBottom: 5 }}><Text style={{ width: 28, color: colors.textPrimary, fontSize }}>{ordered?.[1] || '•'}</Text>
        <Text {...HANDBOOK_TEXT_BREAK_PROPS} style={{ flex: 1, color: colors.textPrimary, fontSize, lineHeight: 31, textAlign: 'left' }}>{renderInline(content, colors.textPrimary)}</Text></View>;
    })}</View>;
    const image = block.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (image) return <View key={key} style={{ marginVertical: 10 }}><Image source={{ uri: image[2] }} resizeMode="contain" style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 7 }} />
      {image[1] ? <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 5 }}>{image[1]}</Text> : null}</View>;
    return <Text {...HANDBOOK_TEXT_BREAK_PROPS} key={key} style={{ color: colors.textPrimary, fontSize, lineHeight: 31, marginBottom: 10, textAlign: 'left' }}>{renderInline(normalizeHandbookSoftBreaks(block), colors.textPrimary)}</Text>;
  });

  const sections: React.ReactNode[] = [];
  const normalized = value.replace(/\r\n/g, '\n');
  const details = /<details(\s+open)?>\s*<summary>([\s\S]*?)<\/summary>\s*([\s\S]*?)<\/details>/gi;
  let offset = 0;
  let match: RegExpExecArray | null;
  while ((match = details.exec(normalized))) {
    if (match.index > offset) sections.push(...renderBlocks(normalized.slice(offset, match.index), `before-${match.index}`));
    const detailsIndex = match.index;
    const open = expanded[detailsIndex] ?? Boolean(match[1]);
    sections.push(<View key={`details-${detailsIndex}`} style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 7, marginVertical: 10, overflow: 'hidden' }}>
      <Pressable onPress={() => setExpanded(previous => ({ ...previous, [detailsIndex]: !open }))} style={{ minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, color: colors.textPrimary, fontSize, fontWeight: '700' }}>{renderInline(match[2].trim() || '点击展开', colors.textPrimary)}</Text>
        <MaterialIcons name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={26} color={colors.textPrimary} />
      </Pressable>
      {open ? <View style={{ borderTopWidth: 1, borderColor: colors.border, padding: 12 }}>{renderBlocks(match[3], `details-body-${detailsIndex}`)}</View> : null}
    </View>);
    offset = details.lastIndex;
  }
  if (offset < normalized.length) sections.push(...renderBlocks(normalized.slice(offset), 'remaining'));
  return <View style={{ minHeight: 430, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 7, backgroundColor: colors.background }}>{sections}</View>;
}
