export const imageLoadingMessages = {
  zh: { loading: '图片加载中', failed: '图片加载失败' },
  'zh-Hant': { loading: '圖片載入中', failed: '圖片載入失敗' },
  en: { loading: 'Loading image', failed: 'Image failed to load' },
  it: { loading: 'Caricamento immagine', failed: 'Impossibile caricare l’immagine' },
};

// Run after parsing local article HTML, including images already served from cache.
export const articleImageLoadingScript = `
(function () {
  document.querySelectorAll('body img').forEach(function (img) {
    var wrapper = document.createElement('span');
    wrapper.className = 'article-image-placeholder';
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', document.body.dataset.imageLoading);
    var indicator = document.createElement('span');
    indicator.className = 'article-image-indicator';
    indicator.innerHTML = '<span class="article-image-spinner"></span>';
    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(img);
    wrapper.appendChild(indicator);
    function finish(ok) {
      wrapper.className = 'article-image-placeholder ' + (ok ? 'is-loaded' : 'is-failed');
      wrapper.setAttribute('aria-label', ok ? (img.alt || '') : document.body.dataset.imageFailed);
      indicator.textContent = ok ? '' : document.body.dataset.imageFailed;
    }
    img.addEventListener('load', function () { finish(true); });
    img.addEventListener('error', function () { finish(false); });
    if (img.complete) finish(img.naturalWidth > 0);
  });
})();
`;

export function articleImageLoadingStyles(background: string, primary: string, text: string): string {
  return `
    .article-image-placeholder { display:block; position:relative; min-height:160px; margin:12px 0; border-radius:8px; overflow:hidden; background:${background}; white-space:normal; }
    .article-image-placeholder img { display:block !important; margin:0 !important; }
    .article-image-placeholder:not(.is-loaded) img { opacity:0; }
    .article-image-placeholder.is-loaded { min-height:0; background:transparent; }
    .article-image-indicator { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:${text}; font-size:14px; }
    .article-image-placeholder.is-loaded .article-image-indicator { display:none; }
    .article-image-placeholder.is-failed img { display:none !important; }
    .article-image-spinner { width:24px; height:24px; border:3px solid ${text}; border-top-color:${primary}; border-radius:50%; animation:article-image-spin 1s linear infinite; }
    @keyframes article-image-spin { to { transform:rotate(360deg); } }
    @media (prefers-reduced-motion:reduce) { .article-image-spinner { animation:none; } }
  `;
}
