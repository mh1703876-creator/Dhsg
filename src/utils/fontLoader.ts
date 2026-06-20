/**
 * Dynamic Font Loader and Base64 Converter for Google Fonts & Custom Uploads
 */

// Cache of loaded fonts to prevent redundant downloads
const loadedFontsCache: { [fontName: string]: string } = {};

/**
 * Injects a CSS @font-face rule into the browser DOM so the font renders in real-time.
 */
export function injectFontIntoDOM(fontName: string, base64Data: string, format: string = 'truetype'): void {
  const styleId = `font-face-preview-${fontName.toLowerCase().replace(/\s+/g, '-')}`;
  
  // Check if already injected
  if (document.getElementById(styleId)) return;

  const fontStyle = document.createElement('style');
  fontStyle.id = styleId;
  fontStyle.innerHTML = `
    @font-face {
      font-family: '${fontName}';
      src: url(data:font/${format};base64,${base64Data}) format('${format}');
      font-display: swap;
    }
  `;
  document.head.appendChild(fontStyle);
}

/**
 * Helper to convert Blob to Base64
 */
function convertBlobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const b64Data = dataUrl.split(',')[1];
      resolve(b64Data);
    };
    reader.onerror = () => reject(new Error('FileReader failed to process font blob.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Strict helper to confirm file has valid uncompressed TrueType (TTF) or OpenType (OTF) signatures
 * before feeding to jsPDF, preventing any low-level PubSub or widths/Unicode dereference crashes.
 */
export function isFontSignatureValid(base64Data: string): boolean {
  try {
    const cleanB64 = (base64Data.includes(',') ? base64Data.split(',')[1] : base64Data).trim().replace(/\s/g, '');
    // We only need the first 4 bytes, so decoding 8 characters (which returns exactly 6 bytes) of base64 is 100% sufficient and safe.
    // This avoids any padding or length issues with atob.
    const raw = window.atob(cleanB64.slice(0, 8));
    if (raw.length < 4) return false;
    const b0 = raw.charCodeAt(0);
    const b1 = raw.charCodeAt(1);
    const b2 = raw.charCodeAt(2);
    const b3 = raw.charCodeAt(3);
    // TTF format: 0x00 0x01 0x00 0x00
    if (b0 === 0 && b1 === 1 && b2 === 0 && b3 === 0) return true;
    // OTF format: "OTTO" (0x4F 0x54 0x54 0x4F)
    if (b0 === 79 && b1 === 84 && b2 === 84 && b3 === 79) return true;
    // TTC format: "ttcf" (0x74 0x74 0x63, 0x66)
    if (b0 === 116 && b1 === 116 && b2 === 99 && b3 === 102) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Helper fetch wrapping with timeout limit
 */
async function fetchWithTimeout(url: string, options: any = {}, timeoutMs: number = 3000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Direct backup provider drawing TTF directly from Google's official open source repository CDN (jsDelivr)
 */
async function downloadDirectTTFFromGitHubCDN(fontName: string): Promise<string> {
  const fontId = fontName.toLowerCase().replace(/\s+/g, '');
  const cleanFontName = fontName.replace(/\s+/g, '');

  let licenseFolder = 'ofl';
  let pathSuffix = `${cleanFontName}-Regular.ttf`;

  if (fontId === 'roboto') {
    licenseFolder = 'apache';
    pathSuffix = `static/Roboto-Regular.ttf`;
  } else if (fontId === 'ubuntu') {
    licenseFolder = 'ufl';
    pathSuffix = `Ubuntu-Regular.ttf`;
  } else if (fontId === 'opensans') {
    pathSuffix = `OpenSans-Regular.ttf`;
  } else if (fontId === 'robotomono') {
    licenseFolder = 'apache';
    pathSuffix = `static/RobotoMono-Regular.ttf`;
  } else if (fontId === 'sourcecodepro') {
    pathSuffix = `SourceCodePro-Regular.ttf`;
  } else if (fontId === 'sourcesanspro') {
    pathSuffix = `SourceSansPro-Regular.ttf`;
  } else if (fontId === 'spacegrotesk') {
    pathSuffix = `SpaceGrotesk-Regular.ttf`;
  } else if (fontId === 'ptsans') {
    pathSuffix = `PTSans-Regular.ttf`;
  } else if (fontId === 'ptserif') {
    pathSuffix = `PTSerif-Regular.ttf`;
  } else if (fontId === 'cormorantgaramond') {
    pathSuffix = `CormorantGaramond-Regular.ttf`;
  } else if (fontId === 'ebgaramond') {
    pathSuffix = `EBGaramond-Regular.ttf`;
  } else if (fontId === 'crimsontext') {
    pathSuffix = `CrimsonText-Regular.ttf`;
  } else if (fontId === 'librebaskerville') {
    pathSuffix = `LibreBaskerville-Regular.ttf`;
  } else if (fontId === 'playfairdisplay') {
    pathSuffix = `PlayfairDisplay-Regular.ttf`;
  }

  const url = `https://cdn.jsdelivr.net/gh/google/fonts@main/${licenseFolder}/${fontId}/${pathSuffix}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download custom TTF from GitHub CDN for ${fontName}`);
  }
  const blob = await response.blob();
  return convertBlobToBase64(blob);
}

/**
 * Downloads a Google Font from the web and returns its TTF as a base64 string.
 */
export async function downloadGoogleFontAsBase64(fontName: string): Promise<string> {
  const cacheKey = fontName.toLowerCase();
  
  if (loadedFontsCache[cacheKey]) {
    return loadedFontsCache[cacheKey];
  }

  const fontId = fontName.toLowerCase().replace(/\s+/g, '-');
  
  // Prioritize the fast, stable mirror 'mranftl' first:
  const mirrors = [
    `https://gwfh.mranftl.com/api/fonts/${fontId}`,
    `https://google-webfonts-helper.herokuapp.com/api/fonts/${fontId}`
  ];

  for (const mirrorUrl of mirrors) {
    try {
      const gwfhResponse = await fetchWithTimeout(mirrorUrl, {}, 2500);
      if (gwfhResponse.ok) {
        const json = await gwfhResponse.json();
        const variants = json.variants || [];
        // Prefer standard 'regular' or '400' variant, or any variant with ttf field
        const bestVariant = variants.find((v: any) => v.id === 'regular' || v.id === '400') || variants[0];
        if (bestVariant && bestVariant.ttf) {
          let ttfUrl = bestVariant.ttf;
          // MANDATORY fix for mixed content: force https protocol
          if (ttfUrl.startsWith('http://')) {
            ttfUrl = ttfUrl.replace('http://', 'https://');
          }
          
          const fontResponse = await fetchWithTimeout(ttfUrl, {}, 3000);
          if (fontResponse.ok) {
            const fontBlob = await fontResponse.blob();
            const base64 = await convertBlobToBase64(fontBlob);
            if (isFontSignatureValid(base64)) {
              loadedFontsCache[cacheKey] = base64;
              return base64;
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Mirror ${mirrorUrl} failed to fetch TTF for ${fontName}:`, error);
    }
  }

  // 1.5. Backup direct Google Fonts Git repository via jsDelivr CDN
  try {
    const gitBase64 = await downloadDirectTTFFromGitHubCDN(fontName);
    if (isFontSignatureValid(gitBase64)) {
      loadedFontsCache[cacheKey] = gitBase64;
      return gitBase64;
    }
  } catch (err) {
    console.warn(`Direct GitHub CDN fallback failed for ${fontName}:`, err);
  }

  // 2. Fallback: Parse Google Fonts CSS API (serves woff2 for modern browsers)
  const cssUrl = `https://fonts.googleapis.com/css?family=${encodeURIComponent(fontName)}`;
  
  try {
    const cssResponse = await fetchWithTimeout(cssUrl, {}, 3000);
    if (!cssResponse.ok) {
      throw new Error(`Google Fonts API returned status ${cssResponse.status}`);
    }
    const cssText = await cssResponse.text();

    // Regular expressions to find the font URLs
    // First try .ttf, then .woff2, then any format.
    const ttfMatch = cssText.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/i);
    const woff2Match = cssText.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2?)\)/i);
    const genericMatch = cssText.match(/url\((https:\/\/[^)]+)\)/i);

    const fontUrl = ttfMatch ? ttfMatch[1] : (woff2Match ? woff2Match[1] : (genericMatch ? genericMatch[1] : null));

    if (!fontUrl) {
      throw new Error(`Could not parse font URL for "${fontName}" from Google Fonts CSS.`);
    }

    // Fetch the raw font file
    const fontResponse = await fetchWithTimeout(fontUrl, {}, 3000);
    if (!fontResponse.ok) {
      throw new Error(`Failed to download font file from ${fontUrl}`);
    }
    const fontBlob = await fontResponse.blob();

    // Convert Blob to Base64
    const base64 = await convertBlobToBase64(fontBlob);

    // Save in cache
    loadedFontsCache[cacheKey] = base64;
    return base64;
  } catch (error) {
    console.error(`Error loading font "${fontName}":`, error);
    throw error;
  }
}

/**
 * Loads and injects a font from Google Fonts dynamically, returned as a Base64 string.
 */
export async function loadAndRegisterGoogleFont(fontName: string): Promise<string> {
  const base64 = await downloadGoogleFontAsBase64(fontName);
  injectFontIntoDOM(fontName, base64, 'truetype');
  return base64;
}

/**
 * Loads a custom uploaded font (TTF, OTF, WOFF) and registers it in the DOM and cache.
 */
export async function processUploadedFont(file: File): Promise<{ name: string; base64: string; format: string }> {
  const fileName = file.name;
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  
  let format = 'truetype';
  if (fileExtension === 'otf') format = 'opentype';
  if (fileExtension === 'woff') format = 'woff';
  if (fileExtension === 'woff2') format = 'woff2';

  // Extract a readable font name by cleaning up the filename
  const cleanFontName = fileName
    .substring(0, fileName.lastIndexOf('.'))
    .split('-').join(' ')
    .split('_').join(' ')
    .replace(/\b\w/g, c => c.toUpperCase()); // Capitalize words

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const b64Data = dataUrl.split(',')[1];
      resolve(b64Data);
    };
    reader.onerror = () => reject(new Error('Failed to read uploaded font file.'));
    reader.readAsDataURL(file);
  });

  // Inject into DOM for live editor integration
  injectFontIntoDOM(cleanFontName, base64, format);

  // Save to preloaded cache as well
  loadedFontsCache[cleanFontName.toLowerCase()] = base64;

  return {
    name: cleanFontName,
    base64,
    format
  };
}
