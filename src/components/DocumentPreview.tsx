import React from 'react';
import { LayoutSettings, FontInfo } from '../types';
import { getColumnLayoutCount, isGridLayout, parseGridLayout } from '../utils/pdfGenerator';

interface DocumentPreviewProps {
  text: string;
  settings: LayoutSettings;
  activeFont: FontInfo | null;
}

export default function DocumentPreview({ text, settings, activeFont }: DocumentPreviewProps) {
  const isGrid = isGridLayout(settings.layout);
  const numCols = getColumnLayoutCount(settings.layout);
  const { rows: gridRows, cols: gridCols } = parseGridLayout(settings.layout);

  // Parse margins representing visually (scale down for preview)
  let mTop = 16;
  let mBottom = 16;
  let mLeft = 16;
  let mRight = 16;

  if (settings.margin !== 'Custom') {
    const val = parseFloat(settings.margin) || 0.5;
    const px = Math.max(8, val * 24); // scale factor
    mTop = mBottom = mLeft = mRight = px;
  } else {
    mTop = Math.max(8, (settings.customMargin.top || 0.5) * 24);
    mBottom = Math.max(8, (settings.customMargin.bottom || 0.5) * 24);
    mLeft = Math.max(8, (settings.customMargin.left || 0.5) * 24);
    mRight = Math.max(8, (settings.customMargin.right || 0.5) * 24);
  }

  // Group text into simple paragraphs for representation
  const paragraphs = text ? text.split(/\r?\n/).filter(p => p.trim() !== '') : [];
  const previewText = paragraphs.slice(0, 8).join(' ');

  // Standard font-family helper
  const fontStyle = {
    fontFamily: activeFont ? `'${activeFont.name}', sans-serif` : 'sans-serif',
    fontSize: `${Math.min(13, Math.max(6, (settings.fontSize || 12) * 0.55))}px`,
    lineHeight: settings.lineSpacing || 1.25,
    textAlign: (settings.alignment === 'Justified' || settings.alignment === 'Auto Alignment' ? 'justify' : 
                settings.alignment.toLowerCase().includes('left') ? 'left' :
                settings.alignment.toLowerCase().includes('right') ? 'right' :
                settings.alignment.toLowerCase().includes('center') ? 'center' : 'left') as any,
  };

  // Helper to slice text segments
  const splitIntoParts = (input: string, count: number): string[] => {
    if (!input) return Array(count).fill('Sample text content...');
    const words = input.split(/\s+/);
    if (words.length === 0) return Array(count).fill('Sample text content...');
    
    const parts: string[] = [];
    const size = Math.ceil(words.length / count);
    for (let i = 0; i < count; i++) {
      const chunk = words.slice(i * size, (i + 1) * size).join(' ');
      parts.push(chunk || 'Continue adding context text...');
    }
    return parts;
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 md:p-6 shadow-xl" id="pdf-preview-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold tracking-wider uppercase text-neutral-400 font-mono">
          Live Layout Proof (Page 1 Mock)
        </h3>
        <span className="text-xs bg-neutral-800 text-neutral-300 font-mono px-2 py-0.5 rounded-full border border-neutral-700">
          Scale: Dynamic Fit
        </span>
      </div>

      {/* Simulated Document Sheet */}
      <div className="relative w-full max-w-sm mx-auto aspect-[1/1.414] bg-zinc-950 border border-zinc-700 p-1 rounded shadow-2xl overflow-hidden">
        {/* Margin Guides (Light border for representation) */}
        <div 
          className="w-full h-full border border-dashed border-neutral-800 relative flex flex-col justify-between"
          style={{
            paddingTop: `${mTop}px`,
            paddingBottom: `${mBottom}px`,
            paddingLeft: `${mLeft}px`,
            paddingRight: `${mRight}px`,
          }}
        >
          {/* Custom Annotations / Stamped Additional Texts */}
          {settings.customAnnotations && settings.customAnnotations.map((ann) => {
            if (!ann.text || ann.text.trim() === '') return null;
            const annIsTop = ann.position.startsWith('Top');
            const annAlign = ann.position.endsWith('Left') ? 'left' : ann.position.endsWith('Right') ? 'right' : 'center';
            let renderText = ann.text;
            if (ann.uppercase) renderText = renderText.toUpperCase();

            return (
              <div
                key={ann.id}
                className="absolute text-[5.5px] text-neutral-400 select-none truncate pointer-events-none"
                style={{
                  top: annIsTop ? `${mTop / 2.3 - 3}px` : 'auto',
                  bottom: !annIsTop ? `${mBottom / 2.3 - 3}px` : 'auto',
                  left: annAlign === 'left' ? `${mLeft}px` : annAlign === 'center' ? '50%' : 'auto',
                  right: annAlign === 'right' ? `${mRight}px` : 'auto',
                  transform: annAlign === 'center' ? 'translateX(-50%)' : 'none',
                  textAlign: annAlign,
                  fontWeight: ann.bold ? 'bold' : 'normal',
                  fontStyle: ann.italic ? 'italic' : 'normal',
                  fontFamily: activeFont ? `'${activeFont.name}', sans-serif` : 'sans-serif',
                }}
                title={ann.text}
              >
                {renderText}
              </div>
            );
          })}

          {/* Header Marker Placement */}
          {settings.markerPlacement.startsWith('Top') && (
            <div 
              className="absolute left-0 right-0 text-[8px] font-mono text-neutral-500 flex justify-between"
              style={{
                top: `${mTop / 2 - 4}px`,
                paddingLeft: `${mLeft}px`,
                paddingRight: `${mRight}px`,
              }}
            >
              <div className={`w-full text-${settings.markerPlacement.endsWith('Left') ? 'left' : settings.markerPlacement.endsWith('Right') ? 'right' : 'center'}`}>
                {settings.counterStyle === 'Page 1, Page 2' ? 'Page 1' : 
                 settings.counterStyle === '1, 2, 3' ? '1' :
                 settings.counterStyle === '1/4, 2/4, 3/4' ? '1/1' :
                 settings.counterStyle === '(1), (2), (3)' ? '(1)' : '[1]'}
              </div>
            </div>
          )}

          {/* Actual Layout Contents */}
          <div className="w-full h-full overflow-hidden flex-1 relative">
            {isGrid ? (
              // Cell Layout UI
              <div 
                className="grid h-full gap-2"
                style={{
                  gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
                  gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                }}
              >
                {splitIntoParts(previewText, gridRows * gridCols).map((chunk, idx) => (
                  <div 
                    key={idx} 
                    className="border border-neutral-800 rounded p-1.5 overflow-hidden flex flex-col bg-zinc-900/40"
                  >
                    <div className="text-[6px] tracking-tight uppercase text-neutral-600 font-mono mb-1 border-b border-neutral-800 pb-0.5">
                      Cell {idx + 1}
                    </div>
                    <p style={fontStyle} className="text-zinc-400 select-none overflow-hidden line-clamp-3">
                      {chunk}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              // Column Layout UI
              <div 
                className="grid h-full gap-3"
                style={{
                  gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
                }}
              >
                {splitIntoParts(previewText, numCols).map((chunk, idx) => (
                  <div key={idx} className="h-full border-r border-neutral-900/50 last:border-0 pr-1 overflow-hidden">
                    <p style={fontStyle} className="text-zinc-300 leading-normal select-none overflow-hidden break-words text-justify">
                      {chunk}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Marker Placement */}
          {settings.markerPlacement.startsWith('Bottom') && (
            <div 
              className="absolute left-0 right-0 text-[8px] font-mono text-neutral-500"
              style={{
                bottom: `${mBottom / 2 - 4}px`,
                paddingLeft: `${mLeft}px`,
                paddingRight: `${mRight}px`,
              }}
            >
              <div className={`w-full text-${settings.markerPlacement.endsWith('Left') ? 'left' : settings.markerPlacement.endsWith('Right') ? 'right' : 'center'}`}>
                {settings.counterStyle === 'Page 1, Page 2' ? 'Page 1' : 
                 settings.counterStyle === '1, 2, 3' ? '1' :
                 settings.counterStyle === '1/4, 2/4, 3/4' ? '1/1' :
                 settings.counterStyle === '(1), (2), (3)' ? '(1)' : '[1]'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info details */}
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-800 text-xs font-mono text-neutral-400">
        <div>
          <span className="text-neutral-500 block">Document Size:</span>
          <span className="text-neutral-300">
            {settings.documentSize === 'Custom' 
              ? `${settings.customSize.width} × ${settings.customSize.height} in` 
              : settings.documentSize}
          </span>
        </div>
        <div>
          <span className="text-neutral-500 block">Margins:</span>
          <span className="text-neutral-300">
            {settings.margin === 'Custom'
              ? `T:${settings.customMargin.top} B:${settings.customMargin.bottom} L:${settings.customMargin.left} R:${settings.customMargin.right}`
              : `${settings.margin} in`}
          </span>
        </div>
        <div>
          <span className="text-neutral-500 block">Font Applied:</span>
          <span className="text-blue-400 truncate block">
            {activeFont ? activeFont.name : 'System default'}
          </span>
        </div>
        <div>
          <span className="text-neutral-500 block">Structure:</span>
          <span className="text-yellow-400">
            {settings.layout}
          </span>
        </div>
      </div>
    </div>
  );
}
