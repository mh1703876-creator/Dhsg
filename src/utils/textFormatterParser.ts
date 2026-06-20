import { jsPDF } from 'jspdf';

export interface StyledChar {
  char: string;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
}

export interface StyledSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
}

export interface TokenSegment {
  text: string;
  isSpace: boolean;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
}

/**
 * Splits segment-level text into individual words or spacing tokens.
 */
export function tokenizeStyledSegments(segments: StyledSegment[]): TokenSegment[] {
  const tokens: TokenSegment[] = [];

  segments.forEach(seg => {
    const parts = seg.text.split(/(\s+)/);
    parts.forEach(part => {
      if (part === '') return;
      tokens.push({
        text: part,
        isSpace: /^\s+$/.test(part),
        bold: seg.bold,
        italic: seg.italic,
        uppercase: seg.uppercase,
      });
    });
  });

  return tokens;
}

/**
 * Draws a line of styled segments in jsPDF, supporting left, center, right, and justified page alignments.
 */
export function drawStyledLine(
  doc: jsPDF,
  segments: StyledSegment[],
  startX: number,
  startY: number,
  colWidth: number,
  align: 'left' | 'center' | 'right' | 'justify',
  loadedFontName: string
) {
  const tokens = tokenizeStyledSegments(segments);
  if (tokens.length === 0) return;

  const originalStyle = doc.getFont().fontStyle;

  // Measure widths of tokens under their respective styles
  const tokenWidths = tokens.map(token => {
    const style = token.italic ? (token.bold ? 'bolditalic' : 'italic') : (token.bold ? 'bold' : 'normal');
    doc.setFont(loadedFontName, style);
    return doc.getTextWidth(token.text);
  });

  const totalWidth = tokenWidths.reduce((sum, w) => sum + w, 0);
  const extraSpace = colWidth - totalWidth;

  let currentX = startX;
  let gapAddition = 0;

  if (align === 'justify') {
    const spaceTokens = tokens.filter(t => t.isSpace);
    const spaceCount = spaceTokens.length;
    const normalSpaceWidth = doc.getTextWidth(' ');
    const maxGapWidth = normalSpaceWidth * 6; // Limit extra spaces gap max width

    if (spaceCount > 0 && extraSpace > 0 && (extraSpace / spaceCount) <= maxGapWidth) {
      gapAddition = extraSpace / spaceCount;
    } else {
      // Fallback alignment for short lines
      currentX = startX;
    }
  } else if (align === 'center') {
    currentX = startX + (colWidth - totalWidth) / 2;
  } else if (align === 'right') {
    currentX = startX + colWidth - totalWidth;
  } else {
    currentX = startX;
  }

  tokens.forEach((token, idx) => {
    const w = tokenWidths[idx];
    const actualWidth = token.isSpace ? (w + gapAddition) : w;

    if (!token.isSpace) {
      const style = token.italic ? (token.bold ? 'bolditalic' : 'italic') : (token.bold ? 'bold' : 'normal');
      doc.setFont(loadedFontName, style);
      try {
        doc.text(token.text, currentX, startY);
      } catch (err) {
        doc.setFont('helvetica', style);
        doc.text(token.text, currentX, startY);
        doc.setFont(loadedFontName, style);
      }
    }

    currentX += actualWidth;
  });

  // Restore document style state
  try {
    doc.setFont(loadedFontName, originalStyle);
  } catch {}
}

/**
 * Scans text to compile an array of styled characters, stripping formatting markers.
 */
export function parseParagraphToStyledChars(text: string): StyledChar[] {
  const result: StyledChar[] = [];
  let i = 0;
  let bold = false;
  let italic = false;
  let uppercase = false;

  while (i < text.length) {
    // Check for combinations
    if (text.startsWith('#*!', i)) {
      bold = !bold;
      italic = !italic;
      uppercase = !uppercase;
      i += 3;
      continue;
    }
    if (text.startsWith('!*#', i)) {
      bold = !bold;
      italic = !italic;
      uppercase = !uppercase;
      i += 3;
      continue;
    }
    if (text.startsWith('#!', i)) {
      bold = !bold;
      italic = !italic;
      uppercase = !uppercase;
      i += 2;
      continue;
    }
    if (text.startsWith('!#', i)) {
      bold = !bold;
      italic = !italic;
      uppercase = !uppercase;
      i += 2;
      continue;
    }
    if (text.startsWith('#*', i)) {
      bold = !bold;
      italic = !italic;
      i += 2;
      continue;
    }
    if (text.startsWith('*#', i)) {
      bold = !bold;
      italic = !italic;
      i += 2;
      continue;
    }

    // Single markers
    const char = text[i];
    if (char === '#') {
      bold = !bold;
      i += 1;
      continue;
    }
    if (char === '*') {
      italic = !italic;
      i += 1;
      continue;
    }
    if (char === '!') {
      uppercase = !uppercase;
      i += 1;
      continue;
    }

    // Add regular character using currently active formatting states
    let finalChar = char;
    if (uppercase) {
      finalChar = finalChar.toUpperCase();
    }

    result.push({
      char: finalChar,
      bold,
      italic,
      uppercase,
    });
    i += 1;
  }

  return result;
}

/**
 * Align split lines of plain text with their corresponding styled attributes.
 */
export function segmentizeLine(
  lineText: string,
  styledChars: StyledChar[],
  currentIndexRef: { value: number }
): StyledSegment[] {
  const segments: StyledSegment[] = [];
  let currentSegment: StyledSegment | null = null;

  for (let charIndex = 0; charIndex < lineText.length; charIndex++) {
    const lineChar = lineText[charIndex];
    let sChar = styledChars[currentIndexRef.value];

    if (sChar && sChar.char === lineChar) {
      currentIndexRef.value++;
    } else {
      // Robust recovery fallback scanning up to 5 forward characters
      let found = false;
      for (let offset = 1; offset <= 5; offset++) {
        const testChar = styledChars[currentIndexRef.value + offset];
        if (testChar && testChar.char === lineChar) {
          currentIndexRef.value += offset + 1;
          sChar = testChar;
          found = true;
          break;
        }
      }
      if (!found) {
        // Fallback default
        sChar = { char: lineChar, bold: false, italic: false, uppercase: false };
      }
    }

    const { bold, italic, uppercase } = sChar;

    if (
      currentSegment &&
      currentSegment.bold === bold &&
      currentSegment.italic === italic &&
      currentSegment.uppercase === uppercase
    ) {
      currentSegment.text += lineChar;
    } else {
      if (currentSegment) {
        segments.push(currentSegment);
      }
      currentSegment = {
        text: lineChar,
        bold,
        italic,
        uppercase,
      };
    }
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  return segments;
}
