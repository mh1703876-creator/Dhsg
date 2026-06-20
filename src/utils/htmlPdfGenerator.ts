import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { LayoutSettings, FontInfo } from '../types';
import { 
  getPageDimensions, 
  getPageMargins, 
  isGridLayout, 
  parseGridLayout, 
  getColumnLayoutCount 
} from './pdfGenerator';
import { injectFontIntoDOM } from './fontLoader';
import { parseParagraphToStyledChars, segmentizeLine, StyledSegment } from './textFormatterParser';

interface ColumnPageData {
  columns: StyledSegment[][][]; // list of columns, each containing a list of lines (list of styling segments)
}

interface GridPageData {
  cells: StyledSegment[][][]; // rows * cols cell slots, each containing a list of lines (list of styling segments)
}

// Compute standard pagination indicator
function computeDynamicMarkerText(current: number, total: number, style: string): string {
  switch (style) {
    case 'Page 1, Page 2':
      return `Page ${current}`;
    case '1, 2, 3':
      return `${current}`;
    case '1/4, 2/4, 3/4':
      return `${current}/${total}`;
    case '(1), (2), (3)':
      return `(${current})`;
    case '[1], [2], [3]':
      return `[${current}]`;
    default:
      return `${current}`;
  }
}

/**
 * Checks if a string contains any Bengali script unicode character.
 */
export function hasBengaliCharacters(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text);
}

/**
 * High-DPI HTML-to-PDF compiler for complex language ligature support.
 * Guarantees correct ligature formation (যেমন: যুক্তাক্ষর, বাংলা) and obeys all layouts, alignments, and padding.
 */
export async function generateBengaliPDF(
  text: string,
  settings: LayoutSettings,
  activeFont: FontInfo | null
): Promise<jsPDF> {
  const { width: pageWidth, height: pageHeight } = getPageDimensions(settings);
  const margins = getPageMargins(settings);

  // Parse layout settings
  const isGrid = isGridLayout(settings.layout);
  const fSize = settings.fontSize || 12;
  const lSpacing = settings.lineSpacing || 1.25;
  const lineHeight = fSize * lSpacing;

  // Set correct font name
  let fontName = 'sans-serif';
  if (activeFont) {
    fontName = activeFont.name;
    if (activeFont.base64Data) {
      try {
        injectFontIntoDOM(activeFont.name, activeFont.base64Data, 'truetype');
      } catch (err) {
        console.warn('Failed to inject font face to DOM:', err);
      }
    }
  }

  // Create temporary jsPDF with exact units and format (points) for correct text splitting math
  const fontDoc = new jsPDF({
    orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [pageWidth, pageHeight],
  });
  if (activeFont && activeFont.base64Data) {
    const fontFilename = `${activeFont.id}.ttf`;
    try {
      fontDoc.addFileToVFS(fontFilename, activeFont.base64Data);
      fontDoc.addFont(fontFilename, activeFont.name, 'normal');
      fontDoc.setFont(activeFont.name, 'normal');
    } catch {}
  }
  fontDoc.setFontSize(fSize);

  const rawParagraphs = text ? text.split(/\r?\n/) : [''];
  const paragraphs = rawParagraphs.map((p) => p.trim());

  let totalPages = 0;
  const columnPages: ColumnPageData[] = [];
  const gridPages: GridPageData[] = [];

  if (isGrid) {
    // Grid Page compilations
    const { rows, cols } = parseGridLayout(settings.layout);
    const totalCells = rows * cols;
    
    const wAvail = pageWidth - margins.left - margins.right;
    const hAvail = pageHeight - margins.top - margins.bottom;
    
    const colGap = 12;
    const rowGap = 12;
    const colWidth = (wAvail - (cols - 1) * colGap) / cols;
    const rowHeight = (hAvail - (rows - 1) * rowGap) / rows;

    let currentCellIndex = 0;
    let currentYInCell = 0;

    const ensureGridPage = (pIdx: number) => {
      while (gridPages.length <= pIdx) {
        gridPages.push({ cells: Array.from({ length: totalCells }, () => []) });
      }
    };

    ensureGridPage(0);

    for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
      const pText = paragraphs[pIndex];
      if (pText === '') {
        currentYInCell += lineHeight;
        continue;
      }

      // Parse styled chars and build plain text
      const styledChars = parseParagraphToStyledChars(pText);
      const plainText = styledChars.map(sc => sc.char).join('');

      const lines: string[] = fontDoc.splitTextToSize(plainText, colWidth);
      const lineSegmentIndexRef = { value: 0 };

      for (let l = 0; l < lines.length; l++) {
        const lineText = lines[l];
        const lineSegments = segmentizeLine(lineText, styledChars, lineSegmentIndexRef);
        
        if (currentYInCell + lineHeight > rowHeight) {
          currentCellIndex++;
          currentYInCell = 0;
        }

        const cellIndexOnPage = currentCellIndex % totalCells;
        const pageOfCell = Math.floor(currentCellIndex / totalCells);

        ensureGridPage(pageOfCell);
        gridPages[pageOfCell].cells[cellIndexOnPage].push(lineSegments);
        
        currentYInCell += lineHeight;
      }
      currentYInCell += lineHeight * 0.4;
    }
    totalPages = gridPages.length;

  } else {
    // Multi-column page compiler
    const numCols = getColumnLayoutCount(settings.layout);
    const wAvail = pageWidth - margins.left - margins.right;
    const hAvail = pageHeight - margins.top - margins.bottom;
    const columnGap = 14.4;
    const colWidth = (wAvail - (numCols - 1) * columnGap) / numCols;

    let pageIndex = 0;
    let colIndex = 0;
    let currentY = margins.top;

    const ensureColumnPage = (pIdx: number) => {
      while (columnPages.length <= pIdx) {
        columnPages.push({ columns: Array.from({ length: numCols }, () => []) });
      }
    };

    ensureColumnPage(0);

    for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
      const pText = paragraphs[pIndex];
      if (pText === '') {
        currentY += lineHeight;
        if (currentY + lineHeight > pageHeight - margins.bottom) {
          colIndex++;
          if (colIndex >= numCols) {
            pageIndex++;
            colIndex = 0;
          }
          currentY = margins.top;
        }
        continue;
      }

      // Parse styled chars and build plain text
      const styledChars = parseParagraphToStyledChars(pText);
      const plainText = styledChars.map(sc => sc.char).join('');

      const lines: string[] = fontDoc.splitTextToSize(plainText, colWidth);
      const lineSegmentIndexRef = { value: 0 };

      for (let l = 0; l < lines.length; l++) {
        const lineText = lines[l];
        const lineSegments = segmentizeLine(lineText, styledChars, lineSegmentIndexRef);

        if (currentY + lineHeight > pageHeight - margins.bottom) {
          colIndex++;
          if (colIndex >= numCols) {
            pageIndex++;
            colIndex = 0;
          }
          currentY = margins.top;
        }

        ensureColumnPage(pageIndex);
        columnPages[pageIndex].columns[colIndex].push(lineSegments);
        
        currentY += lineHeight;
      }
      
      currentY += lineHeight * 0.4;
    }
    totalPages = columnPages.length;
  }

  // Create absolute, hidden DOM container matching the aspect ratios
  const container = document.createElement('div');
  container.id = 'bengali-pdf-staging-holder';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.zIndex = '-9999';
  container.style.width = '2000px'; // ample width
  container.style.backgroundColor = '#111';
  document.body.appendChild(container);

  // Align details
  let textAlignValue = 'left';
  if (settings.alignment === 'Justified' || settings.alignment === 'Auto Alignment') {
    textAlignValue = 'justify';
  } else if (settings.alignment.toLowerCase().includes('center')) {
    textAlignValue = 'center';
  } else if (settings.alignment.toLowerCase().includes('right')) {
    textAlignValue = 'right';
  }

  // Generate HTML Pages
  const pageNodes: HTMLDivElement[] = [];
  const ptToPx = 1.3333; // 96 / 72 Conversion factor

  for (let i = 0; i < totalPages; i++) {
    const pageDiv = document.createElement('div');
    pageDiv.style.width = `${pageWidth * ptToPx}px`;
    pageDiv.style.height = `${pageHeight * ptToPx}px`;
    pageDiv.style.backgroundColor = '#ffffff';
    pageDiv.style.color = '#000000';
    pageDiv.style.position = 'relative';
    pageDiv.style.marginBottom = '20px';
    pageDiv.style.boxSizing = 'border-box';
    pageDiv.style.paddingTop = `${margins.top * ptToPx}px`;
    pageDiv.style.paddingBottom = `${margins.bottom * ptToPx}px`;
    pageDiv.style.paddingLeft = `${margins.left * ptToPx}px`;
    pageDiv.style.paddingRight = `${margins.right * ptToPx}px`;
    pageDiv.style.fontFamily = `"${fontName}", sans-serif`;
    pageDiv.style.fontSize = `${fSize * ptToPx}px`;
    pageDiv.style.lineHeight = `${lSpacing}`;

    // Append Header Marker (if applicable)
    if (settings.markerPlacement.startsWith('Top')) {
      const markerDiv = document.createElement('div');
      markerDiv.style.position = 'absolute';
      markerDiv.style.left = `${margins.left * ptToPx}px`;
      markerDiv.style.right = `${margins.right * ptToPx}px`;
      markerDiv.style.top = `${(margins.top / 2 - 4) * ptToPx}px`;
      markerDiv.style.fontSize = `${(settings.numberFontSize || 10) * ptToPx}px`;
      markerDiv.style.fontFamily = 'monospace';
      markerDiv.style.color = '#4b5563';

      const isLeft = settings.markerPlacement.endsWith('Left');
      const isRight = settings.markerPlacement.endsWith('Right');
      markerDiv.style.textAlign = isLeft ? 'left' : isRight ? 'right' : 'center';
      markerDiv.innerText = computeDynamicMarkerText(i + 1, totalPages, settings.counterStyle);
      pageDiv.appendChild(markerDiv);
    }

    // Append Footer Marker (if applicable)
    if (settings.markerPlacement.startsWith('Bottom')) {
      const markerDiv = document.createElement('div');
      markerDiv.style.position = 'absolute';
      markerDiv.style.left = `${margins.left * ptToPx}px`;
      markerDiv.style.right = `${margins.right * ptToPx}px`;
      markerDiv.style.bottom = `${(margins.bottom / 2 - 4) * ptToPx}px`;
      markerDiv.style.fontSize = `${(settings.numberFontSize || 10) * ptToPx}px`;
      markerDiv.style.fontFamily = 'monospace';
      markerDiv.style.color = '#4b5563';

      const isLeft = settings.markerPlacement.endsWith('Left');
      const isRight = settings.markerPlacement.endsWith('Right');
      markerDiv.style.textAlign = isLeft ? 'left' : isRight ? 'right' : 'center';
      markerDiv.innerText = computeDynamicMarkerText(i + 1, totalPages, settings.counterStyle);
      pageDiv.appendChild(markerDiv);
    }

    // Append Custom Annotations (Custom Margins texts)
    if (settings.customAnnotations) {
      settings.customAnnotations.forEach((ann) => {
        if (!ann.text || ann.text.trim() === '') return;
        const annIsTop = ann.position.startsWith('Top');
        const annAlign = ann.position.endsWith('Left') ? 'left' : ann.position.endsWith('Right') ? 'right' : 'center';
        
        let displayVal = ann.text;
        if (ann.uppercase) displayVal = displayVal.toUpperCase();

        const annDiv = document.createElement('div');
        annDiv.style.position = 'absolute';
        annDiv.style.fontSize = `${(fSize * 0.5) * ptToPx}px`;
        annDiv.style.fontFamily = `"${fontName}", sans-serif`;
        annDiv.style.color = '#9ca3af';
        annDiv.style.boxSizing = 'border-box';
        annDiv.style.fontWeight = ann.bold ? 'bold' : 'normal';
        annDiv.style.fontStyle = ann.italic ? 'italic' : 'normal';
        
        if (annIsTop) {
          annDiv.style.top = `${(margins.top / 2.3 - 3) * ptToPx}px`;
        } else {
          annDiv.style.bottom = `${(margins.bottom / 2.3 - 3) * ptToPx}px`;
        }

        if (annAlign === 'left') {
          annDiv.style.left = `${margins.left * ptToPx}px`;
        } else if (annAlign === 'right') {
          annDiv.style.right = `${margins.right * ptToPx}px`;
        } else {
          annDiv.style.left = '50%';
          annDiv.style.transform = 'translateX(-50%)';
        }
        
        annDiv.innerText = displayVal;
        pageDiv.appendChild(annDiv);
      });
    }

    // Content container filling
    const contentDiv = document.createElement('div');
    contentDiv.style.width = '100%';
    contentDiv.style.height = '100%';
    contentDiv.style.boxSizing = 'border-box';
    contentDiv.style.overflow = 'hidden';

    if (isGrid) {
      const { rows, cols } = parseGridLayout(settings.layout);
      const colGap = 12;
      const rowGap = 12;

      contentDiv.style.display = 'grid';
      contentDiv.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
      contentDiv.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      contentDiv.style.gap = `${colGap * ptToPx}px`;

      const pageData = gridPages[i];
      for (let c = 0; c < rows * cols; c++) {
        const cellDiv = document.createElement('div');
        cellDiv.style.border = '1px solid #e5e7eb';
        cellDiv.style.borderRadius = '4px';
        cellDiv.style.padding = `${6 * ptToPx}px`;
        cellDiv.style.boxSizing = 'border-box';
        cellDiv.style.overflow = 'hidden';
        cellDiv.style.backgroundColor = '#fafafa';

        const cellNumber = document.createElement('div');
        cellNumber.style.fontFamily = 'monospace';
        cellNumber.style.fontSize = `${6 * ptToPx}px`;
        cellNumber.style.color = '#9ca3af';
        cellNumber.style.textTransform = 'uppercase';
        cellNumber.style.marginBottom = `${4 * ptToPx}px`;
        cellNumber.style.borderBottom = '1px solid #f3f4f6';
        cellNumber.style.paddingBottom = `${2 * ptToPx}px`;
        cellNumber.innerText = `Cell ${c + 1}`;
        cellDiv.appendChild(cellNumber);

        const linesList = pageData?.cells[c] || [];
        linesList.forEach((lineSegments) => {
          const lP = document.createElement('p');
          lP.style.margin = '0';
          lP.style.padding = '0';
          lP.style.textAlign = textAlignValue as any;
          lP.style.fontFamily = `"${fontName}", sans-serif`;
          lP.style.fontSize = `${fSize * ptToPx}px`;
          lP.style.lineHeight = `${lSpacing}`;
          lP.style.minHeight = `${lineHeight * ptToPx}px`;

          lineSegments.forEach((seg) => {
            const span = document.createElement('span');
            span.innerText = seg.text;
            if (seg.bold) span.style.fontWeight = 'bold';
            if (seg.italic) span.style.fontStyle = 'italic';
            if (seg.uppercase) span.style.textTransform = 'uppercase';
            lP.appendChild(span);
          });

          cellDiv.appendChild(lP);
        });

        contentDiv.appendChild(cellDiv);
      }

    } else {
      const numCols = getColumnLayoutCount(settings.layout);
      const columnGap = 14.4;

      contentDiv.style.display = 'flex';
      contentDiv.style.flexDirection = 'row';
      contentDiv.style.gap = `${columnGap * ptToPx}px`;

      const pageData = columnPages[i];
      for (let c = 0; c < numCols; c++) {
        const colDiv = document.createElement('div');
        colDiv.style.flex = '1';
        colDiv.style.width = '0'; // force flex equal width split
        colDiv.style.height = '100%';
        colDiv.style.boxSizing = 'border-box';
        
        // Solid border decoration for middle splits
        if (c > 0) {
          colDiv.style.borderLeft = '1px dashed #f3f4f6';
          colDiv.style.paddingLeft = `${columnGap / 2 * ptToPx}px`;
        }

        const linesList = pageData?.columns[c] || [];
        linesList.forEach((lineSegments) => {
          const lP = document.createElement('p');
          lP.style.margin = '0';
          lP.style.padding = '0';
          lP.style.textAlign = textAlignValue as any;
          lP.style.minHeight = `${lineHeight * ptToPx}px`;
          lP.style.wordBreak = 'break-word';
          lP.style.whiteSpace = 'pre-wrap';

          lineSegments.forEach((seg) => {
            const span = document.createElement('span');
            span.innerText = seg.text;
            if (seg.bold) span.style.fontWeight = 'bold';
            if (seg.italic) span.style.fontStyle = 'italic';
            if (seg.uppercase) span.style.textTransform = 'uppercase';
            lP.appendChild(span);
          });

          colDiv.appendChild(lP);
        });

        contentDiv.appendChild(colDiv);
      }
    }

    pageDiv.appendChild(contentDiv);
    container.appendChild(pageDiv);
    pageNodes.push(pageDiv);
  }

  // Micro-delay so browser fully processes style tree and custom loaded ttf fonts
  await new Promise((r) => setTimeout(r, 250));

  // Build the secondary jsPDF instance with the same formats
  const compressMode = settings.compression !== 'High Quality';
  const outDoc = new jsPDF({
    orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [pageWidth, pageHeight],
    compress: compressMode,
  });

  // Loop page-by-page captured canvas additions
  for (let idx = 0; idx < pageNodes.length; idx++) {
    if (idx > 0) {
      outDoc.addPage([pageWidth, pageHeight]);
    }
    outDoc.setPage(idx + 1);

    // Capture using html2canvas with high-DPI scaling of 2.5
    const canvas = await html2canvas(pageNodes[idx], {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    outDoc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
  }

  // Purely clean up DOM immediately
  try {
    document.body.removeChild(container);
  } catch (err) {
    console.warn('DOM temporary cleanup notice:', err);
  }

  return outDoc;
}
