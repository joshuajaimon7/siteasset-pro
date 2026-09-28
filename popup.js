// SiteAsset Pro - Popup Logic
// Media Scanner, Multi-Select, ZIP Bundling, and Lemon Squeezy Integration

const STORE_CHECKOUT_URL = "https://micro-software-lab.lemonsqueezy.com/checkout/buy/212e750c-0132-4e4e-be72-a9ae37970bdd";
const FREE_DOWNLOAD_LIMIT = 5;

let isPro = false;
let allAssets = [];
let selectedAssetIds = new Set();
let activeFilter = 'all';
let currentDomain = 'site';

// DOM Elements
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const downloadZipBtnText = document.getElementById('downloadZipBtnText');
const selectAllBtn = document.getElementById('selectAllBtn');
const countAll = document.getElementById('countAll');
const countSvg = document.getElementById('countSvg');
const countImage = document.getElementById('countImage');
const countFavicon = document.getElementById('countFavicon');
const assetsGrid = document.getElementById('assetsGrid');
const emptyState = document.getElementById('emptyState');
const openDemoBtn = document.getElementById('openDemoBtn');
const upgradeBtn = document.getElementById('upgradeBtn');
const proUpgradeLink = document.getElementById('proUpgradeLink');
const upgradeModal = document.getElementById('upgradeModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const startCheckoutBtn = document.getElementById('startCheckoutBtn');
const licenseKeyInput = document.getElementById('licenseKeyInput');
const activateKeyBtn = document.getElementById('activateKeyBtn');
const licenseStatus = document.getElementById('licenseStatus');
const proHeaderBadge = document.getElementById('proHeaderBadge');
const footerBanner = document.getElementById('footerBanner');

// Init
document.addEventListener('DOMContentLoaded', async () => {
  await checkProStatus();
  await scanTabAssets();
  setupEventListeners();
});

async function checkProStatus() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['isProLicense'], (res) => {
      isPro = !!res.isProLicense;
      renderProUI(isPro);
      resolve();
    });
  });
}

function renderProUI(pro) {
  if (pro) {
    proHeaderBadge.classList.add('unlocked');
    upgradeBtn.textContent = 'Pro Active';
    upgradeBtn.classList.add('is-pro');
    footerBanner.innerHTML = '<span>SiteAsset Pro Unlimited License Active</span>';
  } else {
    proHeaderBadge.classList.remove('unlocked');
    upgradeBtn.textContent = 'Upgrade';
    upgradeBtn.classList.remove('is-pro');
    footerBanner.innerHTML = `
      <span>Free tier: Max ${FREE_DOWNLOAD_LIMIT} asset downloads</span>
      <a href="#" id="proUpgradeLink" class="pro-link">Upgrade to Lifetime ($4.99)</a>
    `;
    const newLink = document.getElementById('proUpgradeLink');
    if (newLink) newLink.addEventListener('click', (e) => { e.preventDefault(); openUpgradeModal(); });
  }
}

async function scanTabAssets() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || tab.url.startsWith('chrome://')) {
      showEmptyState();
      return;
    }

    try {
      currentDomain = new URL(tab.url).hostname.replace('www.', '');
    } catch (e) {
      currentDomain = 'webpage';
    }

    chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PAGE_ASSETS' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.assets) {
        // Fallback: inject content script if tab was opened before extension
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }, () => {
          if (chrome.runtime.lastError) {
            showEmptyState();
            return;
          }
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PAGE_ASSETS' }, (retryRes) => {
              if (retryRes && retryRes.assets && retryRes.assets.length > 0) {
                handleScanResults(retryRes.assets);
              } else {
                showEmptyState();
              }
            });
          }, 150);
        });
      } else if (response.assets.length > 0) {
        handleScanResults(response.assets);
      } else {
        showEmptyState();
      }
    });
  } catch (err) {
    showEmptyState();
  }
}

function handleScanResults(assets) {
  allAssets = assets;
  emptyState.style.display = 'none';
  statusIndicator.classList.add('active');
  statusText.textContent = `Found ${allAssets.length} assets on ${currentDomain}`;

  // Pre-select all
  selectedAssetIds = new Set(allAssets.map(a => a.id));

  // Counts
  const svgs = allAssets.filter(a => a.type === 'svg').length;
  const imgs = allAssets.filter(a => a.type === 'image').length;
  const favs = allAssets.filter(a => a.type === 'favicon').length;

  countAll.textContent = allAssets.length;
  countSvg.textContent = svgs;
  countImage.textContent = imgs;
  countFavicon.textContent = favs;

  updateDownloadBtnText();
  renderGallery();
}

function showEmptyState() {
  emptyState.style.display = 'flex';
  statusIndicator.classList.remove('active');
  statusText.textContent = 'No assets detected on active page';
  countAll.textContent = '0';
  countSvg.textContent = '0';
  countImage.textContent = '0';
  countFavicon.textContent = '0';
}

function updateDownloadBtnText() {
  const count = selectedAssetIds.size;
  downloadZipBtnText.textContent = `Download ZIP (${count})`;
}

function renderGallery() {
  const filtered = allAssets.filter(a => {
    if (activeFilter === 'all') return true;
    return a.type === activeFilter;
  });

  assetsGrid.innerHTML = '';
  if (filtered.length === 0) {
    assetsGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #86868b; padding: 24px; font-size: 11px;">No assets match this category</div>';
    return;
  }

  filtered.forEach(asset => {
    const card = document.createElement('div');
    const isSelected = selectedAssetIds.has(asset.id);
    card.className = `asset-card ${isSelected ? 'selected' : ''}`;

    const dimStr = `${asset.width}x${asset.height}`;

    card.innerHTML = `
      <div class="asset-thumb-wrap">
        <input type="checkbox" class="asset-checkbox" ${isSelected ? 'checked' : ''}>
        <img src="${asset.url}" alt="${asset.name}" loading="lazy">
      </div>
      <div class="asset-meta">
        <span class="asset-name" title="${asset.name}">${asset.name}</span>
        <div class="asset-sub-row">
          <span>${asset.format}</span>
          <span>${dimStr}</span>
        </div>
        <div class="asset-action-links">
          ${asset.type === 'svg' && asset.svgMarkup ? `
            <button class="asset-action-btn copy-svg-btn" title="Copy raw SVG markup">Copy SVG</button>
          ` : ''}
          <button class="asset-action-btn download-single-btn" title="Download single file">Save</button>
        </div>
      </div>
    `;

    // Checkbox toggle
    const checkbox = card.querySelector('.asset-checkbox');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      if (e.target.checked) {
        selectedAssetIds.add(asset.id);
        card.classList.add('selected');
      } else {
        selectedAssetIds.delete(asset.id);
        card.classList.remove('selected');
      }
      updateDownloadBtnText();
    });

    // Copy SVG markup button
    const copyBtn = card.querySelector('.copy-svg-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(asset.svgMarkup).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy SVG'; }, 1200);
        });
      });
    }

    // Download Single file
    const downloadSingleBtn = card.querySelector('.download-single-btn');
    downloadSingleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadSingleAsset(asset);
    });

    assetsGrid.appendChild(card);
  });
}

function downloadSingleAsset(asset) {
  if (asset.type === 'svg' && asset.svgMarkup) {
    const blob = new Blob([asset.svgMarkup], { type: 'image/svg+xml' });
    triggerBlobDownload(blob, asset.name);
  } else {
    chrome.downloads.download({
      url: asset.url,
      filename: asset.name,
      saveAs: false
    });
  }
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Download Selected Assets as ZIP
async function downloadSelectedZip() {
  const selected = allAssets.filter(a => selectedAssetIds.has(a.id));
  if (selected.length === 0) {
    alert('Please select at least 1 asset to download.');
    return;
  }

  // Free Tier Gate: limit to 5 assets
  if (!isPro && selected.length > FREE_DOWNLOAD_LIMIT) {
    openUpgradeModal();
    return;
  }

  downloadZipBtnText.textContent = 'Bundling ZIP...';
  downloadZipBtn.disabled = true;

  try {
    const zip = new SimpleZip();

    for (const asset of selected) {
      let folder = 'images/';
      if (asset.type === 'svg') folder = 'svg-icons/';
      if (asset.type === 'favicon') folder = 'favicons/';

      const filePath = folder + asset.name;

      if (asset.type === 'svg' && asset.svgMarkup) {
        zip.file(filePath, asset.svgMarkup);
      } else if (asset.url.startsWith('data:')) {
        // Base64 Data URL to Uint8Array
        const parts = asset.url.split(',');
        const binary = atob(parts[1]);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        zip.file(filePath, bytes);
      } else {
        // Fetch remote image
        try {
          const resp = await fetch(asset.url);
          const buf = await resp.arrayBuffer();
          zip.file(filePath, new Uint8Array(buf));
        } catch (fetchErr) {
          // If CORS prevents fetch, skip this remote image
        }
      }
    }

    const zipBlob = zip.generate();
    const zipName = `${currentDomain}-assets.zip`;
    triggerBlobDownload(zipBlob, zipName);

  } catch (err) {
    alert('Failed to generate ZIP archive: ' + err.message);
  } finally {
    updateDownloadBtnText();
    downloadZipBtn.disabled = false;
  }
}

// Event Listeners
function setupEventListeners() {
  downloadZipBtn.addEventListener('click', downloadSelectedZip);

  // Select / Deselect All
  selectAllBtn.addEventListener('click', () => {
    if (selectedAssetIds.size === allAssets.length) {
      selectedAssetIds.clear();
      selectAllBtn.textContent = 'Select All';
    } else {
      selectedAssetIds = new Set(allAssets.map(a => a.id));
      selectAllBtn.textContent = 'Deselect All';
    }
    updateDownloadBtnText();
    renderGallery();
  });

  // Filter Pills
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-type');
      renderGallery();
    });
  });

  openDemoBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('demo-test.html') });
  });

  // Upgrade Modal Handlers
  upgradeBtn.addEventListener('click', () => {
    if (!isPro) openUpgradeModal();
  });

  modalCloseBtn.addEventListener('click', closeUpgradeModal);
  upgradeModal.addEventListener('click', (e) => {
    if (e.target === upgradeModal) closeUpgradeModal();
  });

  startCheckoutBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: STORE_CHECKOUT_URL });
  });

  activateKeyBtn.addEventListener('click', handleLicenseActivation);
  licenseKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLicenseActivation();
  });
}

function openUpgradeModal() {
  upgradeModal.style.display = 'flex';
}

function closeUpgradeModal() {
  upgradeModal.style.display = 'none';
  licenseStatus.textContent = '';
  licenseStatus.className = 'license-status';
}

function handleLicenseActivation() {
  const key = (licenseKeyInput.value || '').trim();
  if (!key) {
    showLicenseMsg('Please enter a valid license key', false);
    return;
  }

  if (key.length >= 8) {
    chrome.storage.local.set({ isProLicense: true, licenseKey: key }, () => {
      isPro = true;
      renderProUI(true);
      showLicenseMsg('License activated! All Pro features unlocked.', true);
      setTimeout(() => {
        closeUpgradeModal();
      }, 1400);
    });
  } else {
    showLicenseMsg('Invalid key. Format: ASSET-XXXX-XXXX', false);
  }
}

function showLicenseMsg(msg, success) {
  licenseStatus.textContent = msg;
  licenseStatus.className = `license-status ${success ? 'success' : 'error'}`;
}
