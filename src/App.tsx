import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  Layers, 
  Type, 
  Download, 
  Menu, 
  Undo, 
  Redo, 
  Eraser, 
  Upload, 
  Scissors, 
  Search, 
  Check, 
  FileDown, 
  Sparkles, 
  X, 
  ChevronRight, 
  Info, 
  SlidersHorizontal,
  ChevronDown,
  RefreshCw,
  PlusCircle,
  HelpCircle
} from 'lucide-react';

import { PRELOADED_FONTS } from './data/fonts';
import { FontInfo, DocumentSizeOption, MarginOption, LayoutOption, AlignmentOption, MarkerPlacementOption, CounterStyleOption, CompressionOption, CustomTextAnnotation } from './types';
import { generatePDF } from './utils/pdfGenerator';
import { generateBengaliPDF, hasBengaliCharacters } from './utils/htmlPdfGenerator';
import { loadAndRegisterGoogleFont, processUploadedFont, isFontSignatureValid } from './utils/fontLoader';
import DocumentPreview from './components/DocumentPreview';
import CustomDropdown, { DropdownOption } from './components/CustomDropdown';

// Dropdown data definitions for premium custom UI dropdown components
const documentSizeOptions: DropdownOption<DocumentSizeOption>[] = [
  { value: 'Letter', label: 'Letter Standard (8.5" × 11.0")', sublabel: 'Standard US Paper size' },
  { value: 'A4', label: 'A4 Standard (8.27" × 11.69")', sublabel: 'International Standard size' },
  { value: 'A3', label: 'A3 Presentation (11.69" × 16.54")', sublabel: 'Double A4 format' },
  { value: 'A5', label: 'A5 Miniature (5.83" × 8.27")', sublabel: 'Compact notebook size' },
  { value: 'Legal', label: 'Legal Content (8.5" × 14.0")', sublabel: 'US Legal document size' },
  { value: 'Executive', label: 'Executive Brief (7.25" × 10.5")', sublabel: 'Standard Executive size' },
  { value: 'Tabloid', label: 'Tabloid Large (11.0" × 17.0")', sublabel: 'Posters and brochures' },
  { value: 'Custom', label: 'Custom Dimensions...', sublabel: 'Define your own canvas' },
];

const marginOptions: DropdownOption<MarginOption>[] = [
  { value: '0.2', label: 'Tight Margin (0.2 in)', sublabel: 'Maximizes printable area' },
  { value: '0.3', label: 'Compact Margin (0.3 in)', sublabel: 'Narrow margins' },
  { value: '0.4', label: 'Balanced Margin (0.4 in)', sublabel: 'Slightly narrower than standard' },
  { value: '0.5', label: 'Classic Margins (0.5 in)', sublabel: 'Perfect balance' },
  { value: '0.6', label: 'Roomy Margins (0.6 in)', sublabel: 'Extra surrounding negative space' },
  { value: '0.7', label: 'Generous Margin (0.7 in)', sublabel: 'Spacious borders' },
  { value: '1.0', label: 'Wide Margin (1.0 in)', sublabel: 'Broad borders' },
  { value: '1.5', label: 'Spacious Margin (1.5 in)', sublabel: 'Very deep margins' },
  { value: '2.0', label: 'Maximum Margin (2.0 in)', sublabel: 'Artistic / Minimal focus' },
  { value: 'Custom', label: 'Custom Boundaries...', sublabel: 'Specify coordinates manually' },
];

const layoutOptions: DropdownOption<LayoutOption>[] = [
  { value: 'Single Column', label: 'Single Column (Plain Layout)', sublabel: 'Simple standard document page layout' },
  { value: 'Two Column', label: 'Two Column (Editorial Layout)', sublabel: 'Beautiful dual magazine layout columns' },
  { value: 'Three Column Newspaper', label: 'Three Column (Newspaper Layout)', sublabel: 'Classic multi-column journalistic style' },
  { value: 'Four Column Magazine', label: 'Four Column (Magazine Layout)', sublabel: 'Prestige high-density layout' },
];

const alignmentOptions: DropdownOption<AlignmentOption>[] = [
  { value: 'Left Align', label: 'Left Align', sublabel: 'Standard left alignment' },
  { value: 'Center Align', label: 'Center Align', sublabel: 'Centered headings and poetry' },
  { value: 'Right Align', label: 'Right Align', sublabel: 'Right aligned accents' },
  { value: 'Justified', label: 'Justified', sublabel: 'Clean newspaper-like block edges' },
  { value: 'Auto Alignment', label: 'Auto Align', sublabel: 'Context-sensitive smart alignment' },
];

const markerPlacementOptions: DropdownOption<MarkerPlacementOption>[] = [
  { value: 'Bottom Center', label: 'Bottom Center', sublabel: 'Traditional footer center numbering' },
  { value: 'Bottom Left', label: 'Bottom Left', sublabel: 'Footer alignment left' },
  { value: 'Bottom Right', label: 'Bottom Right', sublabel: 'Footer alignment right' },
  { value: 'Top Center', label: 'Top Center', sublabel: 'Traditional header center numbering' },
  { value: 'Top Left', label: 'Top Left', sublabel: 'Header alignment left' },
  { value: 'Top Right', label: 'Top Right', sublabel: 'Header alignment right' },
];

const counterStyleOptions: DropdownOption<CounterStyleOption>[] = [
  { value: 'Page 1, Page 2', label: 'Page 1, Page 2', sublabel: 'Wordy descriptor counting' },
  { value: '1, 2, 3', label: '1, 2, 3', sublabel: 'Pure minimalistic index digit' },
  { value: '1/4, 2/4, 3/4', label: '1/4, 2/4, 3/4', sublabel: 'Count relative to full document length' },
  { value: '(1), (2), (3)', label: '(1), (2), (3)', sublabel: 'Rounded parentheses frames' },
  { value: '[1], [2], [3]', label: '[1], [2], [3]', sublabel: 'Square brackets blocks' },
];

const compressionOptions: DropdownOption<CompressionOption>[] = [
  { value: 'Maximum Compression', label: 'Maximum Compression (Ultra Small Files)', sublabel: 'Downscale and merge assets' },
  { value: 'Balanced', label: 'Balanced Ratio (Standard Optimization)', sublabel: 'Perfect balance of size and crispness' },
  { value: 'High Quality', label: 'High Quality (Uncompressed Vector Core)', sublabel: 'Absolute high-fidelity typography vectors' },
];

export default function App() {
  // ---- ACTIVE NAV TAB STATE ----
  // 'input' | 'layout' | 'fonts'
  const [activeTab, setActiveTab] = useState<'input' | 'layout' | 'fonts'>('input');

  // ---- TEXT STATE ----
  const [text, setText] = useState<string>("# PDFBRO Document\n\nWelcome to PDFBRO! Type or upload your raw plain text file (.txt) here to render it into a beautifully designed vector PDF.\n\n## Custom Columns & Grids\nThis platform features full dynamic multi-column flows. You can configure up to six columns or create grid arrangements like 2x2, 3x3, and 4x4. The text flows naturally through each grid cell and adds new pages automatically without any textual overlaps.\n\n## Full Margin & Typography Customization\nAdjust all margins, custom dimensions, font-sizes, spacing, alignments, and compressions inside the layout panel. You can also upload your own TTF/OTF custom font files or search and install from our library of over 60 preloaded typography families.");
  const [history, setHistory] = useState<string[]>([""]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // ---- LAYOUT STATE (STRING-BACKED FOR RAW DELETIONS) ----
  const [documentSize, setDocumentSize] = useState<DocumentSizeOption>('Letter');
  const [customWidth, setCustomWidth] = useState<string>("8.5");
  const [customHeight, setCustomHeight] = useState<string>("11.0");

  const [margin, setMargin] = useState<MarginOption>('0.5');
  const [customMarginTop, setCustomMarginTop] = useState<string>("0.5");
  const [customMarginBottom, setCustomMarginBottom] = useState<string>("0.5");
  const [customMarginLeft, setCustomMarginLeft] = useState<string>("0.5");
  const [customMarginRight, setCustomMarginRight] = useState<string>("0.5");

  const [layout, setLayout] = useState<LayoutOption>('Single Column');
  const [fontSize, setFontSize] = useState<string>("12");
  const [lineSpacing, setLineSpacing] = useState<string>("1.25");
  const [alignment, setAlignment] = useState<AlignmentOption>('Left Align');

  const [markerPlacement, setMarkerPlacement] = useState<MarkerPlacementOption>('Bottom Center');
  const [counterStyle, setCounterStyle] = useState<CounterStyleOption>('Page 1, Page 2');
  const [numberFontSize, setNumberFontSize] = useState<string>("10");

  const [compression, setCompression] = useState<CompressionOption>('Balanced');

  // ---- CUSTOM ANNOTATIONS STATE ----
  const [customAnnotations, setCustomAnnotations] = useState<CustomTextAnnotation[]>([]);

  // ---- FONTS STATE ----
  const [activeFont, setActiveFont] = useState<FontInfo | null>(null);
  const [customFonts, setCustomFonts] = useState<FontInfo[]>([]);
  const [fontSearch, setFontSearch] = useState<string>("");
  const [fontCategory, setFontCategory] = useState<string>("all");
  const [fontCache, setFontCache] = useState<{ [fontId: string]: string }>({});
  const [loadingFontId, setLoadingFontId] = useState<string | null>(null);

  // ---- SYSTEM states ----
  const [toastMessage, setToastMessage] = useState<string | null>("Welcome to PDFBRO!");
  const [showToast, setShowToast] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isDragOverInput, setIsDragOverInput] = useState(false);

  // References
  const txtFileInputRef = useRef<HTMLInputElement>(null);
  const customFontInputRef = useRef<HTMLInputElement>(null);

  // Auto-hide toast after a few seconds
  useEffect(() => {
    if (toastMessage) {
      setShowToast(true);
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Initial text set to history
  useEffect(() => {
    setHistory([text]);
    setHistoryIndex(0);
  }, []);

  // Update text with history preservation
  const handleTextChange = (newVal: string) => {
    setText(newVal);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newVal);
    
    // limit history size to 40
    if (newHistory.length > 40) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Undo / Redo Click actions
  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetIdx = historyIndex - 1;
      setHistoryIndex(targetIdx);
      setText(history[targetIdx]);
      setToastMessage("Undo action complete");
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetIdx = historyIndex + 1;
      setHistoryIndex(targetIdx);
      setText(history[targetIdx]);
      setToastMessage("Redo action complete");
    }
  };

  const handleClearText = () => {
    handleTextChange("");
    setToastMessage("Editor text cleared");
  };

  const handleCut = () => {
    if (text) {
      navigator.clipboard.writeText(text)
        .then(() => setToastMessage("Text copied to clipboard and cut"))
        .catch(() => setToastMessage("Text cut from editor"));
      handleTextChange("");
    }
  };

  // TXT file trigger
  const handleTxtFileUploadClick = () => {
    txtFileInputRef.current?.click();
  };

  const handleTxtFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const fileContent = evt.target?.result as string;
      handleTextChange(fileContent);
      setToastMessage(`Loaded: ${file.name}`);
    };
    reader.onerror = () => {
      setToastMessage("Unable to load text asset.");
    };
    reader.readAsText(file);
    // reset input
    e.target.value = '';
  };

  // Drag and Drop files inside input page
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverInput(true);
  };

  const handleDragLeave = () => {
    setIsDragOverInput(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverInput(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const fileContent = evt.target?.result as string;
        handleTextChange(fileContent);
        setToastMessage(`Imported drag-drop file: ${file.name}`);
      };
      reader.readAsText(file);
    } else {
      setToastMessage("Supported file extension is plain-text (.txt) only.");
    }
  };

  // Custom Font trigger & load
  const handleCustomFontUploadClick = () => {
    customFontInputRef.current?.click();
  };

  const handleCustomFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'ttf' && extension !== 'otf' && extension !== 'woff') {
      setToastMessage("Unsupported design. Only .ttf, .otf, and .woff font assets are accepted.");
      return;
    }

    setToastMessage(`Loading customized font asset...`);
    try {
      const processed = await processUploadedFont(file);
      const newFont: FontInfo = {
        id: `uploaded-${Date.now()}`,
        name: processed.name,
        category: 'display',
        isCustom: true,
        base64Data: processed.base64
      };

      setCustomFonts(prev => [newFont, ...prev]);
      setActiveFont(newFont);
      setToastMessage(`Applied custom font "${processed.name}" successfully!`);
    } catch (err) {
      console.error(err);
      setToastMessage("Font ingestion failed. Try another TTF or OTF format.");
    }
    e.target.value = '';
  };

  // Apply Preloaded Google Fonts with on-the-fly network loading
  const handleSelectFont = async (font: FontInfo) => {
    if (font.isCustom) {
      if (font.base64Data && isFontSignatureValid(font.base64Data)) {
        setActiveFont(font);
        setToastMessage(`Custom Font "${font.name}" active`);
      } else {
        setToastMessage(`Warning: Uploaded font signature is corrupt. Reverting to System Helvetica.`);
        setActiveFont(null);
      }
      return;
    }

    // Is cached already?
    if (fontCache[font.id]) {
      const cachedB64 = fontCache[font.id];
      if (isFontSignatureValid(cachedB64)) {
        setActiveFont({
          ...font,
          base64Data: cachedB64
        });
        setToastMessage(`Applied preloaded "${font.name}" font`);
      } else {
        setToastMessage(`Reverting: Cached font "${font.name}" is corrupted. Reverting to Helvetica.`);
        setActiveFont(null);
      }
      return;
    }

    setLoadingFontId(font.id);
    setToastMessage(`Downloading "${font.name}" typographer package...`);
    try {
      const base64 = await loadAndRegisterGoogleFont(font.name);
      
      if (base64 && isFontSignatureValid(base64)) {
        setFontCache(prev => ({ ...prev, [font.id]: base64 }));
        setActiveFont({
          ...font,
          base64Data: base64
        });
        setToastMessage(`Installed and applied "${font.name}" font!`);
      } else {
        setToastMessage(`Font "${font.name}" downloaded but has incompatible layout compression. Reverting to Helvetica.`);
        setActiveFont(null);
      }
    } catch (err) {
      console.error(err);
      setToastMessage(`API Failure: Cannot fetch "${font.name}" assets. Reverting to System Helvetica.`);
      setActiveFont(null);
    } finally {
      setLoadingFontId(null);
    }
  };

  // ---- DYNAMIC LAYOUT PARAMETERS FOR PDF COMPILER ----
  const currentSettings = {
    documentSize,
    customSize: {
      width: parseFloat(customWidth) || 8.5,
      height: parseFloat(customHeight) || 11.0,
    },
    margin,
    customMargin: {
      top: parseFloat(customMarginTop) || 0.5,
      bottom: parseFloat(customMarginBottom) || 0.5,
      left: parseFloat(customMarginLeft) || 0.5,
      right: parseFloat(customMarginRight) || 0.5,
    },
    layout,
    fontSize: parseFloat(fontSize) || 12,
    lineSpacing: parseFloat(lineSpacing) || 1.25,
    alignment,
    markerPlacement,
    counterStyle,
    numberFontSize: parseFloat(numberFontSize) || 10,
    compression,
    customAnnotations,
  };

  // Execute PDF generation
  const handleDownloadPDF = async () => {
    if (!text || text.trim() === "") {
      setToastMessage("Cannot generate an empty document. Fill in content first.");
      return;
    }

    setIsDownloading(true);
    setToastMessage("Compiling layout columns & generating PDF details...");

    try {
      // Simulate micro-delay so UI feels responsive and handles loading smoothly
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const isBengali = hasBengaliCharacters(text) || (activeFont && activeFont.category === 'bangla');
      let doc;

      if (isBengali) {
        setToastMessage("Bengali script detected. Running high-DPI complex ligature layout shaper...");
        doc = await generateBengaliPDF(text, currentSettings, activeFont);
      } else {
        doc = generatePDF(text, currentSettings, activeFont);
      }

      doc.save("pdfbro-document.pdf");
      setToastMessage("Success! Professional PDF exported successfully.");
    } catch (err) {
      console.error("PDF generation failure:", err);
      setToastMessage("An error occurred during layout formatting.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Statistics calculation helpers
  const totalCharacters = text.length;
  const totalWords = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const totalLines = text === "" ? 0 : text.split(/\r?\n/).length;
  const readingTime = Math.ceil(totalWords / 200);

  // Font filtering & searching
  const filteredFonts = PRELOADED_FONTS.filter(font => {
    const matchesSearch = font.name.toLowerCase().includes(fontSearch.toLowerCase());
    const matchesCat = fontCategory === 'all' || font.category === fontCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col font-sans select-none overflow-x-hidden pb-24" id="applet-container">
      
      {/* ---- FIXED TOP HEADER ---- */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-zinc-950 border-b border-neutral-900 z-40 px-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          {/* Strict typography text logo */}
          <span className="text-xl font-bold tracking-[0.2em] font-mono text-white select-none">
            PDF<span className="text-blue-500">BRO</span>
          </span>
          <span className="text-[10px] uppercase font-mono tracking-wider bg-neutral-900 border border-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-md">
            v1.1
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Help Info Button */}
          <button 
            id="help-btn"
            onClick={() => setShowHelpModal(true)}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-900 transition-colors"
            title="Help"
            aria-label="App Help"
          >
            <HelpCircle size={20} />
          </button>

          {/* Download PDF button inside Header */}
          <button 
            id="download-pdf-btn"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold text-xs tracking-wider uppercase transition-all ${
              isDownloading 
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' 
                : 'bg-white text-black hover:bg-neutral-200 active:scale-95'
            }`}
          >
            {isDownloading ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            <span>Export</span>
          </button>

          {/* Core Menu icon */}
          <button 
            id="drawer-trigger-btn"
            onClick={() => {
              setToastMessage("PDFBRO: Double-tap pages or adjust bottom parameters for export.");
            }}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-900 transition-colors"
            aria-label="Menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 w-full max-w-7xl mx-auto pt-20 px-4 grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        
        {/* Left Interactive Side Card (takes 1 or 2 Pages based on tab selection) */}
        <section className="lg:col-span-7 col-span-1 flex flex-col gap-6">

          {/* PAGE 1: INPUT */}
          {activeTab === 'input' && (
            <div className="flex flex-col gap-4 animate-fadeIn" id="page-input-content">
              
              {/* Toolbar Above Textarea Input Box */}
              <div className="bg-zinc-950 border border-neutral-900 rounded-lg p-1.5 flex items-center justify-between gap-1 overflow-x-auto whitespace-nowrap scrollbar-none" id="input-toolbar">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="p-2 rounded-md font-mono text-xs flex items-center gap-1 border border-transparent hover:border-neutral-800 hover:bg-neutral-900 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Undo"
                  >
                    <Undo size={15} />
                    <span className="hidden sm:inline">Undo</span>
                  </button>

                  <button
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className="p-2 rounded-md font-mono text-xs flex items-center gap-1 border border-transparent hover:border-neutral-800 hover:bg-neutral-900 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Redo"
                  >
                    <Redo size={15} />
                    <span className="hidden sm:inline">Redo</span>
                  </button>

                  <div className="h-4 w-px bg-neutral-900"></div>

                  <button
                    onClick={handleCut}
                    className="p-2 rounded-md text-red-400 hover:text-red-300 font-mono text-xs flex items-center gap-1 border border-transparent hover:border-neutral-800 hover:bg-neutral-900/50"
                    title="Cut Content"
                  >
                    <Scissors size={15} />
                    <span className="hidden sm:inline">Cut</span>
                  </button>

                  <button
                    onClick={handleClearText}
                    className="p-2 rounded-md text-neutral-400 hover:text-white font-mono text-xs flex items-center gap-1 border border-transparent hover:border-neutral-800 hover:bg-neutral-900"
                    title="Clear Text"
                  >
                    <Eraser size={15} />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <input 
                    type="file" 
                    id="txt-upload-hidden-input"
                    ref={txtFileInputRef} 
                    onChange={handleTxtFileUpload} 
                    accept=".txt" 
                    className="hidden" 
                  />
                  <button
                    onClick={handleTxtFileUploadClick}
                    className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-md font-mono text-xs flex items-center gap-1.5"
                    title="Load TXT File"
                  >
                    <Upload size={14} />
                    <span>Upload TXT</span>
                  </button>
                </div>
              </div>

              {/* Text Input Wrapper */}
              <div 
                className={`relative bg-zinc-950 border ${
                  isDragOverInput ? 'border-blue-500 bg-neutral-950/80 ring-2 ring-blue-900/20' : 'border-neutral-900'
                } rounded-xl p-2 transition-all shadow-lg flex flex-col`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                id="main-textbox-wrapper"
              >
                
                {isDragOverInput && (
                  <div className="absolute inset-0 bg-black/75 z-20 flex flex-col items-center justify-center border-2 border-dashed border-blue-500 p-6 rounded-xl text-center">
                    <FileText size={48} className="text-blue-400 animate-bounce mb-3" />
                    <p className="text-sm font-semibold tracking-wider text-neutral-200">
                      Incoming TXT Ingestion
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Release to load file contents directly in the editor window
                    </p>
                  </div>
                )}

                <textarea
                  id="pdf-text-editor-box"
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  className="w-full min-h-[340px] md:min-h-[440px] bg-transparent text-neutral-200 p-4 border-0 focus:ring-0 focus:outline-none resize-none text-base leading-relaxed scrollbar-thin placeholder-neutral-600 block"
                  placeholder="Draft your document text here..."
                  style={{
                    fontFamily: activeFont ? `'${activeFont.name}', sans-serif` : 'sans-serif'
                  }}
                  spellCheck="false"
                />

                <div className="text-[10px] text-neutral-500 font-mono text-right pr-2 py-0.5 border-t border-neutral-900 flex justify-between select-none">
                  <span>Formatting rendering active</span>
                  <span>Drag & Drop .txt allowed</span>
                </div>
              </div>

              {/* Real-time Text Statistics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" id="text-statistics-block">
                <div className="bg-zinc-950 border border-neutral-900 p-3 rounded-lg flex flex-col justify-between">
                  <span className="text-[10px] font-mono uppercase text-neutral-500">Characters</span>
                  <span className="text-lg font-bold font-mono text-white mt-1">{totalCharacters}</span>
                </div>
                <div className="bg-zinc-950 border border-neutral-900 p-3 rounded-lg flex flex-col justify-between">
                  <span className="text-[10px] font-mono uppercase text-neutral-500">Words Collected</span>
                  <span className="text-lg font-bold font-mono text-white mt-1">{totalWords}</span>
                </div>
                <div className="bg-zinc-950 border border-neutral-900 p-3 rounded-lg flex flex-col justify-between">
                  <span className="text-[10px] font-mono uppercase text-neutral-500">Lines Tracked</span>
                  <span className="text-lg font-bold font-mono text-white mt-1">{totalLines}</span>
                </div>
                <div className="bg-zinc-950 border border-neutral-900 p-3 rounded-lg flex flex-col justify-between">
                  <span className="text-[10px] font-mono uppercase text-neutral-500">Est. Reading</span>
                  <span className="text-lg font-bold font-mono text-yellow-500 mt-1">
                    {readingTime} {readingTime === 1 ? 'min' : 'mins'}
                  </span>
                </div>
              </div>

            </div>
          )}

          {/* PAGE 2: LAYOUT SETTINGS */}
          {activeTab === 'layout' && (
            <div className="flex flex-col gap-5 animate-fadeIn" id="page-layout-content">
              
              {/* Document Dimensions Card */}
              <div className="bg-zinc-950 border border-neutral-900 rounded-xl p-4 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-neutral-800 text-neutral-200 text-xs font-sans px-2 py-0.5 rounded">01</span>
                  <h4 className="text-xs uppercase tracking-wider font-bold text-neutral-400">Document Size Matrix</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                  <div>
                    <label className="block text-[10.5px] font-sans font-medium text-neutral-400 uppercase tracking-wide mb-1.5">Standard Presets</label>
                    <CustomDropdown
                      id="doc-size-select"
                      value={documentSize}
                      onChange={(val) => setDocumentSize(val)}
                      options={documentSizeOptions}
                    />
                  </div>

                  {documentSize === 'Custom' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-sans text-neutral-400 uppercase mb-1.5">Width (inches)</label>
                        <input
                          type="number"
                          step="0.1"
                          id="custom-width-input"
                          value={customWidth}
                          onChange={(e) => setCustomWidth(e.target.value)}
                          placeholder="e.g. 8.5"
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg py-2.5 px-3 text-neutral-200 text-xs md:text-sm focus:outline-none focus:border-blue-500 font-sans"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-sans text-neutral-400 uppercase mb-1.5">Height (inches)</label>
                        <input
                          type="number"
                          step="0.1"
                          id="custom-height-input"
                          value={customHeight}
                          onChange={(e) => setCustomHeight(e.target.value)}
                          placeholder="e.g. 11"
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg py-2.5 px-3 text-neutral-200 text-xs md:text-sm focus:outline-none focus:border-blue-500 font-sans"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Margins Setup Card */}
              <div className="bg-zinc-950 border border-neutral-900 rounded-xl p-4 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-neutral-800 text-neutral-200 text-xs font-sans px-2 py-0.5 rounded">02</span>
                  <h4 className="text-xs uppercase tracking-wider font-bold text-neutral-400">Page Margins setup</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10.5px] font-sans font-medium text-neutral-400 uppercase tracking-wide mb-1.5">Offset Scale</label>
                    <CustomDropdown
                      id="margin-select"
                      value={margin}
                      onChange={(val) => setMargin(val)}
                      options={marginOptions}
                    />
                  </div>

                  {margin === 'Custom' && (
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[8.5px] font-sans text-neutral-400 uppercase text-center mb-1">Top</label>
                        <input
                          type="number"
                          step="0.05"
                          id="custom-margin-top"
                          value={customMarginTop}
                          onChange={(e) => setCustomMarginTop(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg py-2 px-1 text-neutral-200 text-xs text-center focus:outline-none focus:border-blue-500 font-sans"
                        />
                      </div>
                      <div>
                        <label className="block text-[8.5px] font-sans text-neutral-400 uppercase text-center mb-1">Bottom</label>
                        <input
                          type="number"
                          step="0.05"
                          id="custom-margin-bottom"
                          value={customMarginBottom}
                          onChange={(e) => setCustomMarginBottom(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg py-2 px-1 text-neutral-200 text-xs text-center focus:outline-none focus:border-blue-500 font-sans"
                        />
                      </div>
                      <div>
                        <label className="block text-[8.5px] font-sans text-neutral-400 uppercase text-center mb-1">Left</label>
                        <input
                          type="number"
                          step="0.05"
                          id="custom-margin-left"
                          value={customMarginLeft}
                          onChange={(e) => setCustomMarginLeft(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg py-2 px-1 text-neutral-200 text-xs text-center focus:outline-none focus:border-blue-500 font-sans"
                        />
                      </div>
                      <div>
                        <label className="block text-[8.5px] font-sans text-neutral-400 uppercase text-center mb-1">Right</label>
                        <input
                          type="number"
                          step="0.05"
                          id="custom-margin-right"
                          value={customMarginRight}
                          onChange={(e) => setCustomMarginRight(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg py-2 px-1 text-neutral-200 text-xs text-center focus:outline-none focus:border-blue-500 font-sans"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Column Layout / Grids selection card */}
              <div className="bg-zinc-950 border border-neutral-900 rounded-xl p-4 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-neutral-800 text-neutral-200 text-xs font-sans px-2 py-0.5 rounded">03</span>
                  <h4 className="text-xs uppercase tracking-wider font-bold text-neutral-400">Content Structure & Columns</h4>
                </div>

                <div>
                  <label className="block text-[10.5px] font-sans font-medium text-neutral-400 uppercase tracking-wide mb-1.5">Layout Template</label>
                  <CustomDropdown
                    id="layout-select"
                    value={layout}
                    onChange={(val) => setLayout(val)}
                    options={layoutOptions}
                  />
                  <p className="text-[10px] text-neutral-500 mt-2">
                    Text is loaded sequentially and flows dynamically across columns and pages with zero overlaps.
                  </p>
                </div>
              </div>

              {/* Type Setting Parameters Card */}
              <div className="bg-zinc-950 border border-neutral-900 rounded-xl p-4 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-neutral-800 text-neutral-200 text-xs font-sans px-2 py-0.5 rounded">04</span>
                  <h4 className="text-xs uppercase tracking-wider font-bold text-neutral-400">Word Typographer Attributes</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10.5px] font-sans text-neutral-400 uppercase mb-1.5">Font Size (pt)</label>
                    <input
                      type="number"
                      step="1"
                      id="font-size-input"
                      value={fontSize}
                      onChange={(e) => setFontSize(e.target.value)}
                      placeholder="e.g. 12"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg py-2.5 px-3 text-neutral-200 text-xs md:text-sm focus:outline-none focus:border-blue-500 font-sans"
                    />
                    <span className="text-[9px] text-neutral-600 block mt-1">Fully editable value</span>
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-sans text-neutral-400 uppercase mb-1.5">Line Spacing</label>
                    <input
                      type="number"
                      step="0.05"
                      id="line-spacing-input"
                      value={lineSpacing}
                      onChange={(e) => setLineSpacing(e.target.value)}
                      placeholder="e.g. 1.25"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg py-2.5 px-3 text-neutral-200 text-xs md:text-sm focus:outline-none focus:border-blue-500 font-sans"
                    />
                    <span className="text-[9px] text-neutral-600 block mt-1">e.g. 1.0 (compact), 1.5 (wide)</span>
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-sans font-medium text-neutral-400 uppercase tracking-wide mb-1.5">Alignment</label>
                    <CustomDropdown
                      id="alignment-select"
                      value={alignment}
                      onChange={(val) => setAlignment(val)}
                      options={alignmentOptions}
                    />
                  </div>
                </div>
              </div>

              {/* Page Numbering Card */}
              <div className="bg-zinc-950 border border-neutral-900 rounded-xl p-4 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-neutral-800 text-neutral-200 text-xs font-sans px-2 py-0.5 rounded">05</span>
                  <h4 className="text-xs uppercase tracking-wider font-bold text-neutral-400">Page Navigation Counters</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10.5px] font-sans font-medium text-neutral-400 uppercase tracking-wide mb-1.5">Placement Location</label>
                    <CustomDropdown
                      id="marker-placement-select"
                      value={markerPlacement}
                      onChange={(val) => setMarkerPlacement(val)}
                      options={markerPlacementOptions}
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-sans font-medium text-neutral-400 uppercase tracking-wide mb-1.5">Counter Template</label>
                    <CustomDropdown
                      id="counter-style-select"
                      value={counterStyle}
                      onChange={(val) => setCounterStyle(val)}
                      options={counterStyleOptions}
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-sans text-neutral-400 uppercase mb-1.5">Label size (pt)</label>
                    <input
                      type="number"
                      step="1"
                      id="number-font-size-input"
                      value={numberFontSize}
                      onChange={(e) => setNumberFontSize(e.target.value)}
                      placeholder="e.g. 10"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg py-2.5 px-3 text-neutral-200 text-xs md:text-sm focus:outline-none focus:border-blue-500 font-sans"
                    />
                  </div>
                </div>
              </div>

              {/* Compression & Quality Card */}
              <div className="bg-zinc-950 border border-neutral-900 rounded-xl p-4 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-neutral-800 text-neutral-200 text-xs font-sans px-2 py-0.5 rounded">06</span>
                  <h4 className="text-xs uppercase tracking-wider font-bold text-neutral-400">PDF Quality Compression</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10.5px] font-sans font-medium text-neutral-400 uppercase tracking-wide mb-1.5">Optimization level</label>
                    <CustomDropdown
                      id="compression-select"
                      value={compression}
                      onChange={(val) => setCompression(val)}
                      options={compressionOptions}
                    />
                  </div>

                  <div className="flex flex-col justify-center text-xs text-neutral-500 font-sans leading-relaxed">
                    <span className="text-neutral-400 font-medium">Automatic Optimization:</span>
                    <span>Optimizes internal storage tables, vector boundaries, and metadata structure for 100+ page documents.</span>
                  </div>
                </div>
              </div>

              {/* Custom Additional Header/Footer Texts Card */}
              <div className="bg-zinc-950 border border-neutral-900 rounded-xl p-4 shadow-md flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-neutral-800 text-neutral-200 text-xs font-sans px-2 py-0.5 rounded">07</span>
                    <h4 className="text-xs uppercase tracking-wider font-bold text-neutral-400">Custom Margin Texts / Stamps</h4>
                  </div>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    {customAnnotations.length} / 3 active
                  </span>
                </div>

                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  Superimpose extra custom brand titles, copyright disclaimers, or page identifiers on the borders (margins) of every page.
                </p>

                {customAnnotations.length > 0 && (
                  <div className="flex flex-col gap-4 border-t border-neutral-900 pt-3">
                    {customAnnotations.map((ann, idx) => (
                      <div key={ann.id} className="bg-neutral-900/40 border border-neutral-800/80 rounded-lg p-3 flex flex-col gap-3 relative">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-mono text-neutral-500 font-medium">Text Slot #{idx + 1}</span>
                          <button
                            onClick={() => setCustomAnnotations(prev => prev.filter(a => a.id !== ann.id))}
                            className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                            title="Remove Slot"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Text input */}
                          <div>
                            <label className="block text-[9.5px] text-neutral-400 uppercase mb-1 font-mono">Text Content</label>
                            <input
                              type="text"
                              value={ann.text}
                              onChange={(e) => {
                                const newText = e.target.value;
                                setCustomAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, text: newText } : a));
                              }}
                              placeholder="e.g. PDFBRO CREATIONS"
                              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-1.5 px-2 text-neutral-200 text-xs focus:outline-none focus:border-blue-500"
                            />
                          </div>

                          {/* Position dropdown */}
                          <div>
                            <label className="block text-[9.5px] text-neutral-400 uppercase mb-1 font-mono">Border Location</label>
                            <select
                              value={ann.position}
                              onChange={(e) => {
                                const newPos = e.target.value as any;
                                setCustomAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, position: newPos } : a));
                              }}
                              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded-lg py-1.5 px-2 focus:outline-none focus:border-blue-500 font-sans"
                            >
                              <option value="Top Left">Top Left</option>
                              <option value="Top Center">Top Center</option>
                              <option value="Top Right">Top Right</option>
                              <option value="Bottom Left">Bottom Left</option>
                              <option value="Bottom Center">Bottom Center</option>
                              <option value="Bottom Right">Bottom Right</option>
                            </select>
                          </div>
                        </div>

                        {/* Formatting Toggles */}
                        <div className="flex items-center gap-2 mt-1">
                          {/* Bold */}
                          <button
                            onClick={() => {
                              setCustomAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, bold: !a.bold } : a));
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                              ann.bold
                                ? 'bg-blue-600/10 text-blue-400 border-blue-500/40 font-bold'
                                : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:border-neutral-700'
                            }`}
                          >
                            Bold
                          </button>

                          {/* Uppercase */}
                          <button
                            onClick={() => {
                              setCustomAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, uppercase: !a.uppercase } : a));
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                              ann.uppercase
                                ? 'bg-blue-600/10 text-blue-400 border-blue-500/40 font-bold'
                                : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:border-neutral-700'
                            }`}
                          >
                            Uppercase
                          </button>

                          {/* Italic */}
                          <button
                            onClick={() => {
                              setCustomAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, italic: !a.italic } : a));
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                              ann.italic
                                ? 'bg-blue-600/10 text-blue-400 border-blue-500/40 font-bold italic'
                                : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:border-neutral-700'
                            }`}
                          >
                            Italic
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {customAnnotations.length < 3 ? (
                  <button
                    onClick={() => {
                      const newAnn: CustomTextAnnotation = {
                        id: `ann-${Date.now()}`,
                        text: customAnnotations.length === 0 ? 'PDFBRO CREATIONS' : customAnnotations.length === 1 ? 'A BOOK BY HIMEL' : 'ALL RIGHTS RESERVED',
                        position: customAnnotations.length === 0 ? 'Top Left' : customAnnotations.length === 1 ? 'Bottom Left' : 'Bottom Right',
                        bold: true,
                        uppercase: true,
                        italic: false
                      };
                      setCustomAnnotations([...customAnnotations, newAnn]);
                      setToastMessage("Added new custom margin text slot!");
                    }}
                    className="w-full bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 py-2 rounded-xl text-xs font-mono text-white flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <PlusCircle size={14} />
                    <span>Add Margin Text Slot ({3 - customAnnotations.length} Left)</span>
                  </button>
                ) : (
                  <div className="text-center text-[10px] font-mono text-neutral-600 border border-neutral-900/50 rounded-lg py-2">
                    Slots limit reached (Max 3 annotation texts).
                  </div>
                )}
              </div>

            </div>
          )}

          {/* PAGE 3: FONTS */}
          {activeTab === 'fonts' && (
            <div className="flex flex-col gap-5 animate-fadeIn" id="page-fonts-content">
              
              {/* Ingest font file box */}
              <div className="bg-zinc-950 border border-neutral-900 rounded-xl p-5 shadow-lg">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-neutral-800 text-neutral-200 text-xs font-mono px-2 py-0.5 rounded">TTF/OTF</span>
                    <h4 className="text-xs uppercase tracking-wider font-bold text-neutral-400">Supply Custom Font File</h4>
                  </div>
                  <span className="text-[10px] font-mono text-blue-400 bg-blue-900/10 border border-blue-900/30 px-2 py-0.5 rounded-full">
                    DOM-rendering
                  </span>
                </div>

                <div className="border-2 border-dashed border-neutral-800 rounded-xl p-6 text-center hover:border-neutral-700 transition-colors bg-neutral-950/40">
                  <input
                    type="file"
                    id="font-upload-hidden-input"
                    ref={customFontInputRef}
                    onChange={handleCustomFontUpload}
                    accept=".ttf,.otf,.woff"
                    className="hidden"
                  />
                  <Type size={32} className="mx-auto text-neutral-500 mb-2" />
                  <p className="text-xs text-neutral-300 font-mono mb-1">
                    Drag and drop your .ttf, .otf, or .woff file here
                  </p>
                  <p className="text-[10px] text-neutral-500 mb-3 block">
                    Supported formats: TrueType (TTF), OpenType (OTF), Web Open (WOFF)
                  </p>
                  <button
                    onClick={handleCustomFontUploadClick}
                    className="mx-auto bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-4 py-1.5 rounded-lg text-xs font-mono text-white flex items-center gap-2 transition-all active:scale-95"
                  >
                    <PlusCircle size={14} />
                    <span>Select Font File</span>
                  </button>
                </div>
              </div>

              {/* Search & Category filter */}
              <div className="bg-zinc-950 border border-neutral-900 rounded-xl p-4 flex flex-col gap-4 shadow-md">
                
                {/* Search textfield */}
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    id="font-search-bar"
                    value={fontSearch}
                    onChange={(e) => setFontSearch(e.target.value)}
                    placeholder="Search 60+ preloaded dynamic fonts (e.g. Poppins, Inter, Lora...)"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-10 pr-4 py-2 text-sm text-neutral-200 focus:outline-none focus:border-blue-500 font-sans"
                  />
                  {fontSearch && (
                    <button 
                      onClick={() => setFontSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Categories container list: horizontal scrolling */}
                <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-1.5 scrollbar-thin">
                  {[
                    { id: 'all', label: 'All Styles' },
                    { id: 'bangla', label: 'Bangla/Bengali 🇧🇩' },
                    { id: 'sans-serif', label: 'Sans-Serif' },
                    { id: 'serif', label: 'Serif' },
                    { id: 'monospace', label: 'Monospace' },
                    { id: 'display', label: 'Display' },
                    { id: 'handwriting', label: 'Handwriting' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setFontCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-all ${
                        fontCategory === cat.id
                          ? 'bg-white text-black border-white'
                          : 'bg-neutral-950 text-neutral-400 border-neutral-900 hover:border-neutral-800 hover:text-neutral-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fonts matching list */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                  List of Fonts ({filteredFonts.length} families found)
                </span>

                {/* Custom uploaded assets row */}
                {customFonts.length > 0 && (
                  <div className="bg-neutral-950/20 border border-purple-950/40 rounded-xl p-3 flex flex-col gap-2">
                    <span className="text-[9px] font-mono uppercase text-purple-400 tracking-wider">
                      Your Uploaded Custom Typographies
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {customFonts.map(font => {
                        const isCurrent = activeFont?.id === font.id;
                        return (
                          <div 
                            key={font.id}
                            onClick={() => handleSelectFont(font)}
                            className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                              isCurrent 
                                ? 'bg-purple-950/20 border-purple-500/80 shadow-md ring-1 ring-purple-900/30' 
                                : 'bg-zinc-950 border-neutral-900 hover:border-purple-900'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-xs text-neutral-200 truncate">{font.name}</span>
                              <span className="text-[8px] bg-purple-900/30 border border-purple-800/40 text-purple-300 font-mono px-1 rounded">
                                Custom
                              </span>
                            </div>
                            <span className="text-[10px] text-purple-400 line-clamp-1" style={{ fontFamily: `'${font.name}', sans-serif` }}>
                              The quick brown fox jumps over the lazy dog.
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Preloaded search assets row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1" id="preloaded-fonts-list">
                  {filteredFonts.map(font => {
                    const isCurrent = activeFont?.id === font.id;
                    const isLoadingThis = loadingFontId === font.id;
                    const isCached = !!fontCache[font.id];

                    return (
                      <div
                        key={font.id}
                        id={`font-item-${font.id}`}
                        onClick={() => !isLoadingThis && handleSelectFont(font)}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                          isCurrent
                            ? 'bg-neutral-900 border-blue-500 shadow-md ring-1 ring-blue-900/30'
                            : 'bg-zinc-950 border-neutral-900 hover:border-neutral-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-neutral-100 truncate">{font.name}</span>
                          <span className="text-[8px] uppercase tracking-wider text-neutral-500 font-mono">
                            {isLoadingThis ? 'Retrieving...' : isCached ? 'Cached' : font.category}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span 
                            className={`text-[9px] ${isCurrent ? 'text-neutral-200' : 'text-neutral-400'} truncate flex-1`}
                            style={{ 
                              fontFamily: isCached ? `'${font.name}', sans-serif` : 'inherit'
                            }}
                          >
                            The quick brown fox jumps over the lazy dog.
                          </span>

                          <div className="h-4 w-4 flex items-center justify-center">
                            {isLoadingThis ? (
                              <RefreshCw size={10} className="animate-spin text-blue-400" />
                            ) : isCurrent ? (
                              <Check size={12} className="text-blue-400 font-bold" />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredFonts.length === 0 && (
                    <div className="col-span-2 text-center py-8 bg-zinc-950 border border-neutral-910 rounded-xl text-xs text-neutral-500 font-mono">
                      No matching typography found in archive.
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </section>

        {/* Right Sticky Proof Preview Side Card (takes 5 lg:columns) */}
        <section className="lg:col-span-5 col-span-1 lg:sticky lg:top-24 h-fit flex flex-col gap-4">
          <DocumentPreview 
            text={text} 
            settings={currentSettings} 
            activeFont={activeFont} 
          />

          <div className="bg-zinc-950 border border-neutral-900 p-4 rounded-xl flex flex-col gap-3">
            <h5 className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">
              Quick Export Parameters
            </h5>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-400">Total size estimate:</span>
              <span className="text-xs bg-neutral-900 border border-neutral-800 text-green-500 font-mono px-2 py-0.5 rounded">
                {compression === 'Maximum Compression' ? '~18-25 KB' : compression === 'Balanced' ? '~60-120 KB' : '~1.2 MB'}
              </span>
            </div>

            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className={`w-full py-2.5 rounded-xl text-xs tracking-wider uppercase font-bold transition-all flex items-center justify-center gap-2 border ${
                isDownloading
                  ? 'bg-neutral-900 text-neutral-500 border-neutral-800 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 hover:border-blue-400 hover:shadow-lg active:scale-95'
              }`}
            >
              {isDownloading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <FileDown size={14} />
              )}
              <span>{isDownloading ? "Formatting Layout..." : "Export to PDF File"}</span>
            </button>
          </div>
        </section>

      </main>

      {/* ---- FIXED BOTTOM NAVIGATION BAR ---- */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-neutral-950 border-t border-neutral-900 z-40 px-4 flex items-center justify-around shadow-2xl">
        <button
          id="nav-tab-input"
          onClick={() => setActiveTab('input')}
          className={`flex-1 max-w-xs h-full flex flex-col items-center justify-center gap-1 border-t-2 transition-all ${
            activeTab === 'input'
              ? 'border-blue-500 text-white font-semibold'
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <FileText size={18} />
          <span className="text-[10px] font-mono uppercase tracking-wider">Input</span>
        </button>

        <button
          id="nav-tab-layout"
          onClick={() => setActiveTab('layout')}
          className={`flex-1 max-w-xs h-full flex flex-col items-center justify-center gap-1 border-t-2 transition-all ${
            activeTab === 'layout'
              ? 'border-blue-500 text-white font-semibold'
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Layers size={18} />
          <span className="text-[10px] font-mono uppercase tracking-wider">Layout Settings</span>
        </button>

        <button
          id="nav-tab-fonts"
          onClick={() => setActiveTab('fonts')}
          className={`flex-1 max-w-xs h-full flex flex-col items-center justify-center gap-1 border-t-2 transition-all ${
            activeTab === 'fonts'
              ? 'border-blue-500 text-white font-semibold'
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Type size={18} />
          <span className="text-[10px] font-mono uppercase tracking-wider">Fonts</span>
        </button>
      </nav>

      {/* ---- FLOATING SYSTEM STATUS TOAST ---- */}
      {toastMessage && showToast && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 bg-zinc-900 border border-neutral-800 text-neutral-200 px-4 py-3 rounded-lg shadow-2xl z-50 flex items-center justify-between gap-3 animate-slideUp font-mono text-xs max-w-md">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-blue-400" />
            <span className="leading-snug">{toastMessage}</span>
          </div>
          <button 
            onClick={() => setShowToast(false)}
            className="text-neutral-500 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ---- HELP / USER GUIDE MODAL ---- */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" id="help-modal">
          <div className="bg-neutral-950 border border-neutral-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl font-mono text-xs flex flex-col gap-4 relative">
            <button 
              onClick={() => setShowHelpModal(false)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-white p-1"
            >
              <X size={18} />
            </button>

            <h3 className="text-sm font-bold uppercase tracking-wider text-white border-b border-neutral-800 pb-2">
              PDFBRO USER MANUAL
            </h3>

            <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
              <div>
                <span className="text-blue-400 block font-semibold mb-1">01. CONTENT INPUT</span>
                <p className="text-neutral-400">
                  Type text directly in the massive editor. Upload plain text (.txt) files using the file selector or by dragging the file to the editor. Includes Cut, Undo, Redo, and Clear features.
                </p>
              </div>

              <div>
                <span className="text-yellow-400 block font-semibold mb-1">02. COMPASS LAYOUT</span>
                <p className="text-neutral-400">
                  Format paragraphs into standard multi-columns (up to 6) or grid matrices (2x2, 3x3, 4x4). Change margin white space, page presets, custom sizes, custom tracking heights, and alignments.
                </p>
              </div>

              <div>
                <span className="text-green-400 block font-semibold mb-1">03. ARCHIVE TYPOGRAPHY</span>
                <p className="text-neutral-400">
                  Select and load custom type styles from over 60 Google preloaded fonts. Upload your own .ttf, .otf, or .woff typography files, which immediately register inside the dynamic rendering framework.
                </p>
              </div>

              <div>
                <span className="text-red-400 block font-semibold mb-1">04. PAGE INDEX STRAPS</span>
                <p className="text-neutral-400">
                  Custom page headers and footer straps are plotted dynamically based on placement choices (top, bottom, center, left, right).
                </p>
              </div>
            </div>

            <button 
              onClick={() => setShowHelpModal(false)}
              className="w-full mt-2 bg-white text-black py-2 rounded-xl text-center font-bold tracking-wider hover:bg-neutral-200 transition-all text-xs"
            >
              UNDERSTOOD & PROCEED
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
