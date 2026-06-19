import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { supabase } from '../../lib/supabase';

type ArticleData = {
  title: string;
  category: string;
  content: string | null;
  link: string | null;
  created_at: string;
};

export default function ArticleDetailScreen() {
  const { colors, isDark } = useTheme();
  const { id, url, title: queryTitle } = useLocalSearchParams<{ id: string; url?: string; title?: string }>();
  
  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<ArticleData | null>(null);

  useEffect(() => {
    async function loadArticle() {
      if (id === 'web') {
        // Direct WebURL Mode (e.g. clicked notification link)
        if (url) {
          setArticle({
            title: queryTitle || '文章详情',
            category: 'general',
            content: null,
            link: url,
            created_at: new Date().toISOString(),
          });
        }
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (data) {
          setArticle(data as ArticleData);
        }
      } catch (e) {
        console.warn('Failed to load article detail:', e);
      } finally {
        setLoading(false);
      }
    }

    loadArticle();
  }, [id, url, queryTitle]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!article) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <Text style={{ color: colors.textSecondary }}>文章不存在或已被删除</Text>
        <Pressable style={[styles.backTextButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>返回</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // 1. If it's a WeChat or Web Link, load it in WebView
  if (article.link) {
    // Custom JS injection to hide unwanted WeChat page components on mobile and adapt dark mode if active
    const injectedJS = `
      (function() {
        // Hide unwanted elements (like QR code areas, PC share bars)
        const style = document.createElement('style');
        style.innerHTML = '#js_pc_qr_code, .qr_code_pc_outer, #js_share_app_msg, #js_profile_qrcode, .profile_qrcode_area, .global_share_dialog, .global_share_btn, .qr_code_pc_inner, .qr_code_pc { display: none !important; }';
        document.head.appendChild(style);

        ${isDark ? `
          // Enable WeChat native dark theme
          document.documentElement.setAttribute('data-theme', 'dark');
          document.body.setAttribute('data-theme', 'dark');
          document.documentElement.classList.add('theme-dark');
          document.body.classList.add('theme-dark');

          // Inject custom dark theme styles for backup override (covering container, text and bottom bar)
          const darkStyle = document.createElement('style');
          darkStyle.innerHTML = \`
            html, body, .rich_media, .rich_media_inner, .rich_media_area_primary, .rich_media_content, #img-content, .rich_media_tool, .appmsg_tool, .appmsg_tool_wrp, .tool_wrp, .rich_media_extra, .rich_media_extra_inside, .like_comment_area, .like_comment_wrapper, #js_unshare_area, #js_to_share, .reward_area {
              background-color: #0F0F0F !important;
              color: #F5F5F5 !important;
            }
            .rich_media_title, .rich_media_meta_text, .rich_media_meta_nickname, .rich_media_content, .rich_media_content p, .rich_media_content span, .rich_media_content section, .rich_media_content h1, .rich_media_content h2, .rich_media_content h3, .rich_media_content h4 {
              color: #F5F5F5 !important;
              background-color: transparent !important;
            }
            .appmsg_tool *, .rich_media_tool *, .rich_media_extra *, .rich_media_meta_list *, .profile_container * {
              background-color: transparent !important;
              color: #A0A0A0 !important;
            }
            a {
              color: #C41E2A !important;
            }
          \`;
          document.head.appendChild(darkStyle);
        ` : ''}
      })();
      true;
    `;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        {/* Custom Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {article.title}
          </Text>
          <View style={styles.headerPlaceholder} />
        </View>

        {/* WebView */}
        <WebView
          source={{ uri: article.link }}
          injectedJavaScript={injectedJS}
          style={{ flex: 1, backgroundColor: colors.background }}
          startInLoadingState
          renderLoading={() => (
            <ActivityIndicator style={StyleSheet.absoluteFill} size="large" color={colors.primary} />
          )}
          // Enable prefers-color-scheme media query handling on webviews
          forceDarkOn={isDark}
          mixedContentMode="always"
          domStorageEnabled={true}
          javaScriptEnabled={true}
        />
      </SafeAreaView>
    );
  }

  // 2. If it is local HTML/text content, load a styled local HTML in WebView
  const localHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          body {
            color: ${colors.textPrimary};
            background-color: ${colors.background};
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            padding: 16px;
            margin: 0;
            line-height: 1.6;
            font-size: 15px;
          }
          h1 {
            font-size: 22px;
            font-weight: bold;
            color: ${colors.textPrimary};
            margin-bottom: 8px;
            margin-top: 8px;
            line-height: 1.3;
          }
          .meta {
            font-size: 12px;
            color: ${colors.textMuted};
            margin-bottom: 24px;
            border-bottom: 1px solid ${colors.border};
            padding-bottom: 12px;
          }
          img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin-top: 12px;
            margin-bottom: 12px;
          }
          p {
            margin-top: 0;
            margin-bottom: 16px;
          }
        </style>
      </head>
      <body>
        <h1>${article.title}</h1>
        <div class="meta">
          发布日期：${new Date(article.created_at).toLocaleDateString('zh-CN')}
        </div>
        <div>
          ${article.content || '<p>暂无内容</p>'}
        </div>
      </body>
    </html>
  `;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Custom Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          详情
        </Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Styled Local Web Content */}
      <WebView
        originWhitelist={['*']}
        source={{ html: localHtml }}
        style={{ flex: 1, backgroundColor: colors.background }}
        startInLoadingState
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backArrow: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: 8,
    marginVertical: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    maxWidth: '70%',
  },
  headerPlaceholder: {
    width: 50,
  },
  backTextButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
});
