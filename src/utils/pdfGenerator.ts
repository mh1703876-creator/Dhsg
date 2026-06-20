import { jsPDF } from 'jspdf';
import { LayoutSettings, FontInfo, CustomMargin } from '../types';
import { isFontSignatureValid } from './fontLoader';
import { parseParagraphToStyledChars, segmentizeLine, drawStyledLine } from './textFormatterParser';

// Helper to convert inches to points
const inToPt = (inch: number) => inch * 72;

// Get page size in points
export function getPageDimensions(settings: LayoutSettings): { width: number; height: number } {
  switch (settings.documentSize) {
    case 'A4':
      return { width: 595, height: 842 };
    case 'A3':
      return { width: 842, height: 1191 };
    case 'A5':
      return { width: 420, height: 595 };
    case 'Letter':
      return { width: 612, height: 792 };
    case 'Legal':
      return { width: 612, height: 1008 };
    case 'Executive':
      return { width: 522, height: 756 };
    case 'Tabloid':
      return { width: 792, height: 1224 };
    case 'Custom':
      const w = settings.customSize.width || 8.5;
      const h = settings.customSize.height || 11.0;
      return { width: inToPt(w), height: inToPt(h) };
    default:
      return { width: 595, height: 842 }; // fallback A4
  }
}

// Get margins in points
export function getPageMargins(settings: LayoutSettings): CustomMargin {
  if (settings.margin === 'Custom') {
    return {
      top: inToPt(settings.customMargin.top || 0.5),
      bottom: inToPt(settings.customMargin.bottom || 0.5),
      left: inToPt(settings.customMargin.left || 0.5),
      right: inToPt(settings.customMargin.right || 0.5),
    };
  }

  const value = parseFloat(settings.margin) || 0.5;
  const ptVal = inToPt(value);
  return {
    top: ptVal,
    bottom: ptVal,
    left: ptVal,
    right: ptVal,
  };
}

// Helper to check if a layout option is grid-based
export function isGridLayout(layout: string): boolean {
  return layout.includes('x');
}

// Parse grid parameters from layout setting (e.g., '2x2 Grid' -> { rows: 2, cols: 2 })
export function parseGridLayout(layout: string): { rows: number; cols: number } {
  if (layout.startsWith('2x2')) return { rows: 2, cols: 2 };
  if (layout.startsWith('3x3')) return { rows: 3, cols: 3 };
  if (layout.startsWith('4x4')) return { rows: 4, cols: 4 };
  return { rows: 1, cols: 1 };
}

// Get number of columns for column layouts
export function getColumnLayoutCount(layout: string): number {
  if (layout.startsWith('Single')) return 1;
  if (layout.startsWith('Double') || layout.startsWith('Two')) return 2;
  if (layout.startsWith('Triple') || layout.startsWith('Three')) return 3;
  if (layout.startsWith('Four')) return 4;
  return 1;
}

/**
 * Core layout compiler
 * Takes text and formatting parameters, computes the positions of all text elements,
 * and compiles them into a complete jsPDF document.
 */
export function generatePDF(
  text: string,
  settings: LayoutSettings,
  activeFont: FontInfo | null
): jsPDF {
  const { width: pageWidth, height: pageHeight } = getPageDimensions(settings);
  const margins = getPageMargins(settings);

  // Initialize jsPDF
  // Use compact compression if needed
  const compressMode = settings.compression !== 'High Quality';
  const doc = new jsPDF({
    orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [pageWidth, pageHeight],
    compress: compressMode,
  });

  // Load custom font if available
  let loadedFontName = 'helvetica';

  if (activeFont && activeFont.base64Data && isFontSignatureValid(activeFont.base64Data)) {
    try {
      const fontFilename = `${activeFont.id}.ttf`;
      
      // Self-defensive dry run: verify if jsPDF can register, select, and render utilizing this custom font.
      // If this throws any exceptions (like 'No unicode cmap for font' or 'Cannot read properties of undefined (reading "Unicode")'),
      // we catch it immediately and gracefully fallback to 'helvetica'.
      const tempDoc = new jsPDF();
      tempDoc.addFileToVFS(fontFilename, activeFont.base64Data);
      tempDoc.addFont(fontFilename, activeFont.name, 'normal');
      tempDoc.setFont(activeFont.name, 'normal');
      tempDoc.text('test', 10, 10);
      tempDoc.splitTextToSize('test text to split', 100);
      
      // Force immediate PDF assembly evaluation to fully parse and build custom font cmap, tables & widths
      tempDoc.output();
      
      // Since the test document successfully compiled this custom font, we register it on our main document
      doc.addFileToVFS(fontFilename, activeFont.base64Data);
      doc.addFont(fontFilename, activeFont.name, 'normal');
      loadedFontName = activeFont.name;
    } catch (err) {
      console.warn('Custom font registration or text rendering failed. Falling back to Helvetica:', err);
      loadedFontName = 'helvetica';
    }
  }

  // Set font properties
  const fSize = settings.fontSize || 12;
  const lSpacing = settings.lineSpacing || 1.25;
  const numFSize = settings.numberFontSize || 10;
  
  doc.setFont(loadedFontName, 'normal');
  doc.setFontSize(fSize);

  // Split content by paragraphs
  const rawParagraphs = text ? text.split(/\r?\n/) : [''];
  // Trim empty lines but keep single returns as separation
  const paragraphs = rawParagraphs.map((p) => p.trim());

  // Determine layouts
  const isGrid = isGridLayout(settings.layout);

  if (isGrid) {
    // ---- GRID LAYOUT FLOW ----
    const { rows, cols } = parseGridLayout(settings.layout);
    const totalCells = rows * cols;
    
    const wAvail = pageWidth - margins.left - margins.right;
    const hAvail = pageHeight - margins.top - margins.bottom;
    
    const colGap = 12; // Gap spacing in points
    const rowGap = 12;
    
    const colWidth = (wAvail - (cols - 1) * colGap) / cols;
    const rowHeight = (hAvail - (rows - 1) * rowGap) / rows;
    
    let currentCellIndex = 0;
    
    // We keep track of height inside the active cell
    let cellLines: { text: string; x: number; y: number; align: string }[] = [];
    let linesInCellIndex = 0;
    let currentYInCell = 0; // Relative to current cell top

     // Loop paragraphs
    for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
      const pText = paragraphs[pIndex];
      if (pText === '') {
        // Add a blank vertical line spacing space if permitted
        currentYInCell += fSize * lSpacing;
        continue;
      }

      // Parse styled chars and build plain text
      const styledChars = parseParagraphToStyledChars(pText);
      const plainText = styledChars.map(sc => sc.char).join('');

      // Split paragraph text to cell width
      const lines: string[] = doc.splitTextToSize(plainText, colWidth);
      const lineSegmentIndexRef = { value: 0 };

      for (let l = 0; l < lines.length; l++) {
        const lineText = lines[l];
        const lineSegments = segmentizeLine(lineText, styledChars, lineSegmentIndexRef);
        const lineHeight = fSize * lSpacing;

        // Check cell overflow
        if (currentYInCell + lineHeight > rowHeight) {
          // Advance to next cell
          currentCellIndex++;
          currentYInCell = 0;
        }

        // Draw active page if we filled all cells on the current one
        const cellIndexOnPage = currentCellIndex % totalCells;
        const pageOfCell = Math.floor(currentCellIndex / totalCells);

        // Synchronize jsPDF pages
        while (doc.getNumberOfPages() <= pageOfCell) {
          doc.addPage([pageWidth, pageHeight]);
        }

        doc.setPage(pageOfCell + 1);
        doc.setFont(loadedFontName, 'normal');
        doc.setFontSize(fSize);

        // Compute actual cell positions
        const cellRow = Math.floor(cellIndexOnPage / cols);
        const cellCol = cellIndexOnPage % cols;

        const cellX = margins.left + cellCol * (colWidth + colGap);
        const cellY = margins.top + cellRow * (rowHeight + rowGap);

        // Position current Y coordinate in absolute PDF values
        // Note: we must align text baseline, jsPDF prints text slightly relative to baseline
        let finalAlign: 'left' | 'center' | 'right' | 'justify' = getAlignmentParam(settings.alignment);
        if (settings.alignment === 'Auto Alignment') {
          if (lines.length > 1) {
            finalAlign = (l === lines.length - 1) ? 'left' : 'justify';
          } else {
            finalAlign = (lineText.length < 30) ? 'center' : 'left';
          }
        } else if (settings.alignment === 'Justified') {
          finalAlign = (l === lines.length - 1) ? 'left' : 'justify';
        }

        const drawY = cellY + currentYInCell + fSize; // push down by font size to stand in box

        drawStyledLine(doc, lineSegments, cellX, drawY, colWidth, finalAlign, loadedFontName);

        currentYInCell += lineHeight;
      }

      // Add paragraph separation spacing
      currentYInCell += (fSize * lSpacing) * 0.4;
    }

  } else {
    // ---- COLUMN LAYOUT FLOW ----
    const numCols = getColumnLayoutCount(settings.layout);
    
    const wAvail = pageWidth - margins.left - margins.right;
    const hAvail = pageHeight - margins.top - margins.bottom;
    
    const columnGap = 14.4; // 0.2 inches gap
    const colWidth = (wAvail - (numCols - 1) * columnGap) / numCols;
    
    let pageIndex = 0;
    let colIndex = 0;
    let currentY = margins.top;

    for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
      const pText = paragraphs[pIndex];
      if (pText === '') {
        currentY += fSize * lSpacing;
        continue;
      }

      // Parse styled chars and build plain text
      const styledChars = parseParagraphToStyledChars(pText);
      const plainText = styledChars.map(sc => sc.char).join('');

      const lines: string[] = doc.splitTextToSize(plainText, colWidth);
      const lineSegmentIndexRef = { value: 0 };

      for (let l = 0; l < lines.length; l++) {
        const lineText = lines[l];
        const lineSegments = segmentizeLine(lineText, styledChars, lineSegmentIndexRef);
        const lineHeight = fSize * lSpacing;

        // Check column overflow
        if (currentY + lineHeight > pageHeight - margins.bottom) {
          colIndex++;
          if (colIndex >= numCols) {
            pageIndex++;
            colIndex = 0;
          }
          currentY = margins.top;
        }

        // Add pages if necessary
        while (doc.getNumberOfPages() <= pageIndex) {
          doc.addPage([pageWidth, pageHeight]);
        }

        doc.setPage(pageIndex + 1);
        doc.setFont(loadedFontName, 'normal');
        doc.setFontSize(fSize);

        // Calculate positions
        const colX = margins.left + colIndex * (colWidth + columnGap);
        // Determine dynamic alignment
        let finalAlign: 'left' | 'center' | 'right' | 'justify' = getAlignmentParam(settings.alignment);
        if (settings.alignment === 'Auto Alignment') {
          if (lines.length > 1) {
            finalAlign = (l === lines.length - 1) ? 'left' : 'justify';
          } else {
            finalAlign = (lineText.length < 30) ? 'center' : 'left';
          }
        } else if (settings.alignment === 'Justified') {
          finalAlign = (l === lines.length - 1) ? 'left' : 'justify';
        }

        // Add font size offset so text isn't cut off at top margin boundary
        const drawY = currentY + fSize;

        drawStyledLine(doc, lineSegments, colX, drawY, colWidth, finalAlign, loadedFontName);

        currentY += lineHeight;
      }

      // Spacing between paragraphs
      currentY += (fSize * lSpacing) * 0.4;
    }
  }

  // ---- RENDER PAGE NUMBER REFS AND FOOTERS / HEADERS ----
  const totalPages = doc.getNumberOfPages();
  for (let pIdx = 1; pIdx <= totalPages; pIdx++) {
    doc.setPage(pIdx);
    doc.setFont(loadedFontName, 'normal');
    doc.setFontSize(numFSize);

    // Compute marker numeric label
    const markerText = computeMarkerText(pIdx, totalPages, settings.counterStyle);

    // Coordinate setups
    let markerX = pageWidth / 2;
    let markerY = pageHeight - 24;
    let markerAlign: 'center' | 'left' | 'right' = 'center';

    const placementStyle = settings.markerPlacement;

    // Y position
    if (placementStyle.startsWith('Top')) {
      markerY = 30; // centered in top margin area
    } else {
      markerY = pageHeight - 30; // centered in bottom margin area
    }

    // X position & Align-type
    if (placementStyle.endsWith('Left')) {
      markerX = margins.left;
      markerAlign = 'left';
    } else if (placementStyle.endsWith('Right')) {
      markerX = pageWidth - margins.right;
      markerAlign = 'right';
    } else {
      markerX = pageWidth / 2;
      markerAlign = 'center';
    }

    try {
      doc.text(markerText, markerX, markerY, {
        align: markerAlign,
      });
    } catch (err) {
      doc.setFont('helvetica', 'normal');
      doc.text(markerText, markerX, markerY, {
        align: markerAlign,
      });
      doc.setFont(loadedFontName, 'normal');
    }

    // ---- RENDER ADDITIONAL CUSTOM ANNOTATIONS ----
    if (settings.customAnnotations && settings.customAnnotations.length > 0) {
      for (const ann of settings.customAnnotations) {
        if (!ann.text || ann.text.trim() === '') continue;

        let renderText = ann.text;
        if (ann.uppercase) renderText = renderText.toUpperCase();

        const styleName = ann.italic ? (ann.bold ? 'bolditalic' : 'italic') : (ann.bold ? 'bold' : 'normal');

        try {
          doc.setFont(loadedFontName, styleName);
        } catch {
          // fallback
        }
        doc.setFontSize(numFSize);

        const annIsTop = ann.position.startsWith('Top');
        const annAlign = ann.position.endsWith('Left') ? 'left' : ann.position.endsWith('Right') ? 'right' : 'center';

        let annX = pageWidth / 2;
        // Place vertically nested nicely: top margin / 2 or bottom margin / 2
        let annY = annIsTop ? (margins.top / 2.2) : (pageHeight - (margins.bottom / 2.2));

        if (annAlign === 'left') {
          annX = margins.left;
        } else if (annAlign === 'right') {
          annX = pageWidth - margins.right;
        }

        try {
          doc.text(renderText, annX, annY, {
            align: annAlign,
          });
        } catch {
          doc.setFont('helvetica', styleName);
          doc.text(renderText, annX, annY, {
            align: annAlign,
          });
        }
        // Restore standard regular loaded font
        doc.setFont(loadedFontName, 'normal');
      }
    }
  }

  return doc;
}

// Helpers for Alignment sizing
function getAlignmentParam(align: string): 'left' | 'center' | 'right' | 'justify' {
  const norm = align.toLowerCase();
  if (norm.includes('left')) return 'left';
  if (norm.includes('right')) return 'right';
  if (norm.includes('center')) return 'center';
  if (norm.includes('justified') || norm.includes('justify')) return 'justify';
  return 'left';
}

function getAlignedX(line: string, startX: number, width: number, align: string): number {
  const norm = align.toLowerCase();
  if (norm.includes('left') || norm.includes('justified') || norm.includes('justify') || norm.includes('auto')) {
    return startX;
  }
  if (norm.includes('right')) {
    return startX + width;
  }
  if (norm.includes('center')) {
    return startX + width / 2;
  }
  return startX;
}

/**
 * Renders a single line of text with custom justified spacing,
 * spreading words out evenly across a fixed width container.
 */
function drawJustifiedLine(
  doc: jsPDF,
  lineText: string,
  startX: number,
  startY: number,
  colWidth: number,
  loadedFontName: string,
  styleName: string = 'normal'
) {
  const words = lineText.trim().split(/\s+/);
  if (words.length <= 1) {
    try {
      doc.text(lineText, startX, startY);
    } catch {
      doc.setFont('helvetica', styleName);
      doc.text(lineText, startX, startY);
      doc.setFont(loadedFontName, styleName);
    }
    return;
  }

  // Calculate widths of words
  const wordWidths = words.map(w => doc.getTextWidth(w));
  const totalWordsWidth = wordWidths.reduce((sum, w) => sum + w, 0);
  const extraSpace = colWidth - totalWordsWidth;

  // Normal spaces width
  const normalSpaceWidth = doc.getTextWidth(' ');
  const maxGapWidth = normalSpaceWidth * 6; // Limit gap to 6 spaces maximum
  const gaps = words.length - 1;
  const gapWidth = extraSpace / gaps;

  if (extraSpace <= 0 || gapWidth > maxGapWidth) {
    // Regular fallback spacing
    try {
      doc.text(lineText, startX, startY);
    } catch {
      doc.setFont('helvetica', styleName);
      doc.text(lineText, startX, startY);
      doc.setFont(loadedFontName, styleName);
    }
    return;
  }

  let currentX = startX;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    try {
      doc.text(word, currentX, startY);
    } catch {
      doc.setFont('helvetica', styleName);
      doc.text(word, currentX, startY);
      doc.setFont(loadedFontName, styleName);
    }
    currentX += wordWidths[i] + gapWidth;
  }
}

// Marker labels generator
function computeMarkerText(current: number, total: number, style: string): string {
  switch (style) {
    case 'Page 1, Page 2':
    case 'Page X':
      return `Page ${current}`;
    case '1, 2, 3':
    case 'Number':
      return `${current}`;
    case '1/4, 2/4, 3/4':
    case 'Fraction':
      return `${current}/${total}`;
    case '(1), (2), (3)':
    case 'Parentheses':
      return `(${current})`;
    case '[1], [2], [3]':
    case 'Brackets':
      return `[${current}]`;
    default:
      return `Page ${current}`;
  }
}
