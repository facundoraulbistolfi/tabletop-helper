export type FacingDirection = "up" | "right" | "down" | "left";

export type TokenState = "base" | "path" | "home" | "finished";

export interface Token {
  id: string;
  state: TokenState;
  pathIdx: number;
  homeIdx: number;
  baseSlot: number;
  facing: FacingDirection;
}

export type TokenMap = Record<number, Token[]>;

export interface BoardCoord {
  row: number;
  col: number;
}

export interface PcfgEntry {
  startIdx: number;
  homeStretch: BoardCoord[];
  basePos: BoardCoord[];
  safeIdx: number;
}

export type CellMeta =
  | { type: "base"; player: number }
  | { type: "center" }
  | { type: "path"; idx: number }
  | { type: "home"; player: number; idx: number }
  | { type: "empty" };

export type GameMode = "normal" | "divertido" | "hardcore";

export interface RouletteSection {
  value: number;
  label: string;
  weight: number;
  color: string;
}

export interface PixelFrame {
  rows: string[];
  palette: Record<string, string>;
}

export interface RasterFrameSource {
  frameSrcByDirection: Record<FacingDirection, string>;
}

export interface CharacterDefinition {
  id: string;
  setId: string;
  name: string;
  color: string;
  glow: string;
  home: string;
  frames: Record<FacingDirection, PixelFrame>;
  rasterFrames?: RasterFrameSource;
  previewFrame: FacingDirection;
}

export interface CharacterSetDefinition {
  id: string;
  name: string;
  description: string;
  characters: CharacterDefinition[];
}

export interface PlayerSetupSlot {
  characterId: string;
  displayName: string;
  hasCustomName: boolean;
}

export interface RuntimePlayer extends CharacterDefinition {
  seatId: number;
  displayName: string;
}

export interface MoveSegment {
  row: number;
  col: number;
  facing: FacingDirection;
}

export interface ExecuteMoveResult {
  tokens: TokenMap;
  captured: boolean;
  capturedTokenIds: string[];
  contestedTokenIds: string[];
  finished: boolean;
  segments: MoveSegment[];
}
