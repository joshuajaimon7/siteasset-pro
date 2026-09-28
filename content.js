// SiteAsset Pro - Content Script
// Deep DOM Asset Extractor: Images, Inline SVGs, CSS Backgrounds, Favicons & Video Posters

(function () {
  if (window.__siteasset_injected) return;
  window.__siteasset_injected = true;

  function getFileExtension(url) {
    if (!url) return 'png';
    if (url.startsWith('data:image/svg+xml')) return 'svg';
    if (url.startsWith('data:image/png')) return 'png';
    if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) return 'jpg';
    if (url.startsWith('data:image/webp')) return 'webp';
    if (url.startsWith('data:image/gif')) return 'gif';

    try {
      const pathname = new URL(url).pathname;
      const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
      if (match) {
        const ext = match[1].toLowerCase();
        if (['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'ico', 'avif'].includes(ext)) {
          return ext === 'jpeg' ? 'jpg' : ext;
        }
      }
    } catch (e) {}
    return 'png';
  }

  function cleanFileName(raw, fallback, ext) {
    if (!raw) return `${fallback}.${ext}`;
    let name = raw.split('/').pop().split('?')[0].replace(/[^a-zA-Z0-9-_]/g, '_');
    if (name.length > 40) name = name.substring(0, 40);
    if (!name.endsWith('.' + ext)) name += '.' + ext;
    return name;
  }

  function scanAllAssets() {
    const assets = [];
    const seenUrls = new Set();
    let counter = 1;

    // 1. Scan standard <img> tags
    const images = Array.from(document.querySelectorAll('img'));
    images.forEach((img, idx) => {
      const src = img.currentSrc || img.src;
      if (!src || seenUrls.has(src)) return;

      // Filter out 1x1 tracking pixels
      const w = img.naturalWidth || img.clientWidth || 0;
      const h = img.naturalHeight || img.clientHeight || 0;
      if (w > 0 && w < 12 && h > 0 && h < 12) return;

      seenUrls.add(src);
      const ext = getFileExtension(src);
      const name = cleanFileName(img.alt || img.title || `image-${idx + 1}`, `image-${idx + 1}`, ext);

      assets.push({
        id: `img_${counter++}`,
        type: ext === 'svg' ? 'svg' : 'image',
        url: src,
        width: w || 'Auto',
        height: h || 'Auto',
        name,
        format: ext.toUpperCase()
      });
    });

    // 2. Scan inline <svg> elements (Crucial for modern UI icons & logos)
    const svgs = Array.from(document.querySelectorAll('svg'));
    svgs.forEach((svg, idx) => {
      // Skip hidden tiny SVGs
      const rect = svg.getBoundingClientRect();
      const w = Math.round(rect.width) || parseInt(svg.getAttribute('width'), 10) || 24;
      const h = Math.round(rect.height) || parseInt(svg.getAttribute('height'), 10) || 24;
      if (w < 8 && h < 8) return;

      // Clone and sanitize SVG
      const clone = svg.cloneNode(true);
      if (!clone.getAttribute('xmlns')) {
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }

      const markup = new XMLSerializer().serializeToString(clone);
      const name = cleanFileName(svg.id || svg.getAttribute('aria-label') || `icon-${idx + 1}`, `vector-icon-${idx + 1}`, 'svg');

      assets.push({
        id: `svg_${counter++}`,
        type: 'svg',
        svgMarkup: markup,
        url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup),
        width: w,
        height: h,
        name,
        format: 'SVG'
      });
    });

    // 3. Scan CSS Background Images
    const allElements = document.querySelectorAll('*');
    const maxElements = Math.min(allElements.length, 1200);

    for (let i = 0; i < maxElements; i++) {
      const el = allElements[i];
      if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;

      try {
        const bg = window.getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none' && bg.startsWith('url(')) {
          const match = bg.match(/url\(['"]?(.*?)['"]?\)/);
          if (match && match[1]) {
            const fullUrl = new URL(match[1], window.location.href).href;
            if (!seenUrls.has(fullUrl)) {
              seenUrls.add(fullUrl);
              const ext = getFileExtension(fullUrl);
              const name = cleanFileName(`bg-asset-${counter}`, `background-${counter}`, ext);

              assets.push({
                id: `bg_${counter++}`,
                type: 'image',
                url: fullUrl,
                width: el.offsetWidth || 'Auto',
                height: el.offsetHeight || 'Auto',
                name,
                format: ext.toUpperCase()
              });
            }
          }
        }
      } catch (e) {}
    }

    // 4. Scan Favicons & Apple Touch Icons
    const icons = Array.from(document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"]'));
    icons.forEach((link, idx) => {
      const href = link.href;
      if (href && !seenUrls.has(href)) {
        seenUrls.add(href);
        const ext = getFileExtension(href);
        const name = cleanFileName(`favicon-${idx + 1}`, 'favicon', ext);

        assets.push({
          id: `fav_${counter++}`,
          type: 'favicon',
          url: href,
          width: 32,
          height: 32,
          name,
          format: ext.toUpperCase()
        });
      }
    });

    return assets;
  }

  // Listener for popup queries
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SCAN_PAGE_ASSETS') {
      const results = scanAllAssets();
      sendResponse({
        success: true,
        assets: results,
        title: document.title,
        domain: window.location.hostname
      });
      return true;
    }
  });
})();
