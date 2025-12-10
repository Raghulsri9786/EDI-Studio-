
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  image?: string;
  video?: string;
  sources?: Array<{
    uri: string;
    title: string;
  }>;
}

export interface EdiAnalysisResult {
  summary: string;
  transactionType: string;
  transactionSet?: string; // e.g., "850"
  version?: string; // e.g., "004010"
  standard: 'X12' | 'EDIFACT' | 'UNKNOWN';
  sender?: string;
  receiver?: string;
  details: string;
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  line?: number;
  segmentId?: string;
  elementId?: string;
  source: 'LOCAL' | 'AI' | 'STEDI';
  suggestion?: string;
}

export interface OrchestratedResult {
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
  metrics: {
    segmentCount: number;
    errorCount: number;
    warningCount: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100
}

export interface MappingEntry {
  sourceRef: string; // e.g. "BEG-03"
  value: string;     // e.g. "223901"
  targetField: string; // e.g. "orderNumber"
  description: string;
}

export interface EdiFile {
  id: string;
  name: string;
  content: string;
  lastModified: Date;
  analysis?: EdiAnalysisResult;
  // Comparison support
  isCompareView?: boolean;
  compareData?: {
    files: EdiFile[];
  };
  // Cloud metadata
  cloudId?: string; 
  isSynced?: boolean;
}

export interface CloudFileVersion {
  id: string;
  created_at: string;
  version_name: string;
  content: string;
}

export interface CompareOptions {
  ignoreTimestamps: boolean;
  ignoreControlNumbers: boolean;
  ignoreWhitespace: boolean;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  VIEWING = 'VIEWING',
}

export enum AppMode {
  EDITOR = 'EDITOR',
  COMPARE = 'COMPARE',
  MAPPER = 'MAPPER',
  AI_STUDIO = 'AI_STUDIO',
}

export type PanelTab = 'chat' | 'validate' | 'tools' | 'json';

export interface ComparisonResult {
  diffAnalysis: string;
  timestamp: Date;
}

export interface AppSettings {
  fontSize: 'small' | 'medium' | 'large';
  showLineNumbers: boolean;
  theme: 'light' | 'dark'; 
  aiModel: 'balanced' | 'speed' | 'power';
  aiProvider: 'gemini' | 'deepseek';
  geminiApiKey?: string;
  deepSeekApiKey?: string;
}

// --- SMART EDITOR TYPES ---

export interface SegmentSchema {
  id: string;
  name: string;
  purpose: string;
  elements: ElementSchema[];
}

export interface ElementSchema {
  index: number;
  id: string; // e.g., ISA06
  name: string;
  type: 'AN' | 'N0' | 'N2' | 'ID' | 'DT' | 'TM' | 'R';
  min: number;
  max: number;
  qualifiers?: Record<string, string>; // Map of code -> meaning
}

export interface EdiToken {
  type: 'SEGMENT_ID' | 'ELEMENT' | 'DELIMITER' | 'TERMINATOR';
  value: string;
  index: number; // Index in the segment array (0=ID, 1=Elem1)
  fullId?: string; // e.g., ISA06
  schema?: ElementSchema | SegmentSchema;
  hasError?: boolean;
  errorMessage?: string;
  validationError?: string;
}

export interface ParsedLine {
  lineNumber: number;
  raw: string;
  segmentId: string;
  indent: number;
  isLoopStart: boolean;
  tokens: EdiToken[];
  loopEndLine?: number; // If this is a start, where does it end?
  errors?: LineError[];
}

export interface LineError {
  line: number;
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
  tokenIndex?: number; // Which element caused it (-1 for whole line)
}

export interface EditorValidationResult {
  isValid: boolean;
  errors: LineError[];
}

// --- DIFF ENGINE TYPES ---
export type DiffType = 'SAME' | 'ADDED' | 'REMOVED' | 'MODIFIED' | 'EMPTY';

export interface DiffPart {
  type: 'SAME' | 'ADDED' | 'REMOVED';
  value: string;
}

export interface DiffLine {
  index: number | null; // The line number in the respective file (null if phantom)
  content: string;
  type: DiffType;
  parts?: DiffPart[]; // For character-level diffs in MODIFIED lines
}

export interface DiffResult {
  leftLines: DiffLine[];
  rightLines: DiffLine[];
  changeCount: number;
}

// --- MAPPING & SCHEMA TYPES ---

export interface ErpSchemaNode {
  id: string;
  name: string;
  type: 'object' | 'array' | 'string' | 'number' | 'date';
  required?: boolean;
  description?: string;
  children?: ErpSchemaNode[];
}

export interface ErpSchema {
  transactionType: string;
  name: string;
  root: ErpSchemaNode;
  rawContent?: string; // The raw XSD text for the AI to parse
}

export interface MappingRule {
  id: string;
  sourcePath: string; // e.g. "BEG/03"
  targetPath: string; // e.g. "Order/Header/OrderNumber"
  transform?: string; // e.g. "uppercase()"
}

// --- STEDI TYPES ---
export interface StediConfig {
  apiKey: string;
  partnershipId: string;
  transactionSettingId: string;
}
