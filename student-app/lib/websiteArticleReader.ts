/** Presentation only: injected into this App's WebView, never saved to WordPress. */
export function isWebsiteArticleUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'asscubo.it' && !url.port && !url.username && !url.password;
  } catch { return false; }
}

type ReaderColors = { background: string; textPrimary: string; primary: string };

export function websiteArticleReaderScript(colors: ReaderColors, isDark: boolean): string {
  const css = `
    /* Hide the theme chrome early, while the article DOM is still parsing. */
    body.single-post #masthead, body.single-post .top-bar,
    body.single-post #secondary, body.single-post #colophon,
    body.single-post .article-meta, body.single-post .entry-header .entry-meta,
    body.single-post .entry-footer, body.single-post .post-navigation,
    body.single-post #comments, body.single-post .back-to-top { display:none !important; }

    /* Retain only the paths to the title, featured image and complete article body.
       No selector trims descendants of the body, including its images/QR codes. */
    html[data-boxue-reader] [data-boxue-reader-path] > :not([data-boxue-reader-path]):not([data-boxue-reader-keep]):not(style):not(link) {
      display:none !important;
    }
    html[data-boxue-reader], html[data-boxue-reader] body {
      background:${colors.background} !important; color:${colors.textPrimary} !important;
      margin:0 !important; padding:0 !important; min-height:100% !important;
    }
    html[data-boxue-reader] [data-boxue-reader-path]:not(body) {
      display:block !important; float:none !important; position:static !important;
      width:100% !important; max-width:none !important; min-width:0 !important;
      margin:0 !important; padding:0 !important; border:0 !important;
      box-shadow:none !important; background:transparent !important;
    }
    html[data-boxue-reader] [data-boxue-reader-path]::before,
    html[data-boxue-reader] [data-boxue-reader-path]::after { display:none !important; }
    html[data-boxue-reader] article[data-boxue-reader-path] {
      box-sizing:border-box !important; padding:20px 16px 32px !important;
      max-width:760px !important; margin:0 auto !important;
    }
    html[data-boxue-reader] [data-boxue-reader-keep="title"] {
      font-size:26px !important; line-height:1.4 !important; font-weight:700 !important;
      letter-spacing:normal !important; text-align:left !important;
      color:${colors.textPrimary} !important; margin:0 0 20px !important;
      padding:0 !important; overflow-wrap:anywhere;
    }
    html[data-boxue-reader] [data-boxue-reader-keep="cover"] {
      margin:0 0 20px !important; padding:0 !important; width:100% !important;
    }
    html[data-boxue-reader] [data-boxue-reader-keep="content"] {
      margin:0 !important; padding:0 !important; width:100% !important;
      font-size:16px; line-height:1.75; overflow-wrap:break-word;
      color:${colors.textPrimary} !important; background:transparent !important;
    }
    html[data-boxue-reader] [data-boxue-reader-keep] img,
    html[data-boxue-reader] [data-boxue-reader-keep] video {
      max-width:100% !important; height:auto !important;
    }
    html[data-boxue-reader] [data-boxue-reader-keep="content"] iframe { max-width:100% !important; }
    ${isDark ? `
      html[data-boxue-reader] [data-boxue-reader-keep="content"] :where(p,span,section,div,h1,h2,h3,h4,h5,h6,li,blockquote) {
        color:${colors.textPrimary} !important; background-color:transparent !important;
      }
      html[data-boxue-reader] [data-boxue-reader-keep="content"] a { color:${colors.primary} !important; }
    ` : ''}
  `;
  return `
    (function () {
      if (location.protocol !== 'https:' || location.hostname !== 'asscubo.it') return;
      if (window.__boxueWebsiteReader) { window.__boxueWebsiteReader(); return; }
      var css = ${JSON.stringify(css)};
      function mark(node, value) {
        if (!node.hasAttribute('data-boxue-reader-keep')) node.setAttribute('data-boxue-reader-keep', value);
        for (var parent = node.parentElement; parent && parent !== document.documentElement; parent = parent.parentElement) {
          if (!parent.hasAttribute('data-boxue-reader-path')) parent.setAttribute('data-boxue-reader-path', '');
        }
      }
      function apply() {
        if (!document.documentElement) return;
        if (!document.getElementById('boxue-website-reader-style')) {
          var style = document.createElement('style');
          style.id = 'boxue-website-reader-style'; style.textContent = css;
          (document.head || document.documentElement).appendChild(style);
        }
        var content = document.querySelector('article.type-post .entry-content');
        var article = content && content.closest('article.type-post');
        var title = article && article.querySelector('.entry-header .entry-title');
        // A non-article destination or changed theme must never become a blank page.
        if (!content || !title) return;
        mark(title, 'title'); mark(content, 'content');
        var cover = article.querySelector('figure.post-thumbnail');
        if (cover && !content.contains(cover)) mark(cover, 'cover');
        document.documentElement.setAttribute('data-boxue-reader', '');
      }
      window.__boxueWebsiteReader = apply;
      apply();
      document.addEventListener('DOMContentLoaded', apply);
      var queued = false;
      new MutationObserver(function () {
        if (queued) return;
        queued = true;
        setTimeout(function () { queued = false; apply(); }, 80);
      }).observe(document, { childList:true, subtree:true });
    })();
    true;
  `;
}
