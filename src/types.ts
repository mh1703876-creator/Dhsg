export interface CustomSize {
  width: number; // in inches
  height: number; // in inches
}

export interface CustomMargin {
  top: number; // in inches
  bottom: number; // in inches
  left: number; // in inches
  right: number; // in inches
}

export type DocumentSizeOption = 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Executive' | 'Tabloid' | 'Custom';
export type MarginOption = '0.2' | '0.3' | '0.4' | '0.5' | '0.6' | '0.7' | '1.0' | '1.5' | '2.0' | 'Custom';
export type LayoutOption = 
  | 'Single Column'
  | 'Two Column'
  | 'Three Column Newspaper'
  | 'Four Column Magazine';

export type AlignmentOption = 'Left Align' | 'Right Align' | 'Center Align' | 'Justified' | 'Auto Alignment';
export type MarkerPlacementOption = 'Top Center' | 'Bottom Center' | 'Top Left' | 'Top Right' | 'Bottom Left' | 'Bottom Right';
export type CounterStyleOption = 'Page 1, Page 2' | '1, 2, 3' | '1/4, 2/4, 3/4' | '(1), (2), (3)' | '[1], [2], [3]';
export type CompressionOption = 'Maximum Compression' | 'Balanced' | 'High Quality';

export interface CustomTextAnnotation {
  id: string;
  text: string;
  position: MarkerPlacementOption;
  bold: boolean;
  uppercase: boolean;
  italic: boolean;
}

export interface LayoutSettings {
  documentSize: DocumentSizeOption;
  customSize: CustomSize;
  margin: MarginOption;
  customMargin: CustomMargin;
  layout: LayoutOption;
  fontSize: number;
  lineSpacing: number;
  alignment: AlignmentOption;
  markerPlacement: MarkerPlacementOption;
  counterStyle: CounterStyleOption;
  numberFontSize: number;
  compression: CompressionOption;
  customAnnotations?: CustomTextAnnotation[];
}

export interface FontInfo {
  id: string;
  name: string;
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace' | 'bangla';
  url?: string;
  isCustom?: boolean;
  base64Data?: string; // Base64 content of loaded TTF, OTF, or WOFF file
}
