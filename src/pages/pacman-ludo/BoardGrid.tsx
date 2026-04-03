import { memo } from "react";

import { BOARD_CELLS, getCellType, GRID, PCFG, SAFE } from "../../lib/pac-ludo/board";
import { CENTER_PAC_CHARACTER_ID, CHARACTERS_BY_ID } from "../../lib/pac-ludo/characters";
import type { RuntimePlayer } from "../../lib/pac-ludo/types";
import { PixelSprite } from "./PixelSprite";

type BoardGridProps = {
  boardSize: number;
  cellSize: number;
  playerCount: number;
  players: RuntimePlayer[];
  showCenterCharacter?: boolean;
};

export const BoardGrid = memo(function BoardGrid({
  boardSize,
  cellSize,
  playerCount,
  players,
  showCenterCharacter = true,
}: BoardGridProps) {
  const centerCharacter = CHARACTERS_BY_ID[CENTER_PAC_CHARACTER_ID];

  return (
    <div
      style={{
        position: "relative",
        width: boardSize,
        height: boardSize,
        background: "#000119",
        borderRadius: Math.max(4, cellSize * 0.25),
        border: "2px solid #1a1a4a",
        boxShadow: "0 0 24px #00008833, inset 0 0 30px #00001a",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 2,
          border: "1px solid #1a1a6a",
          borderRadius: Math.max(3, cellSize * 0.18),
          pointerEvents: "none",
        }}
      />
      {BOARD_CELLS.map(({ row, col }) => {
        const meta = getCellType(row, col);
        let background = "transparent";
        let border = "none";
        let shadow: string | undefined;
        let content: React.ReactNode = null;

        if (meta.type === "path") {
          background = "#1a1a2e";
          border = "1px solid #2a2a4a";
          if (SAFE.has(meta.idx)) {
            const safeSeat = [0, 1, 2, 3].find((seat) => PCFG[seat].safeIdx === meta.idx);
            const owner = safeSeat !== undefined && safeSeat < playerCount ? players[safeSeat] : null;
            if (owner) {
              shadow = `inset 0 0 6px ${owner.color}33`;
              content = (
                <div
                  style={{
                    width: Math.max(3, cellSize * 0.18),
                    height: Math.max(3, cellSize * 0.18),
                    borderRadius: "50%",
                    background: owner.color,
                    opacity: 0.65,
                  }}
                />
              );
            } else {
              content = (
                <div
                  style={{
                    width: Math.max(2, cellSize * 0.1),
                    height: Math.max(2, cellSize * 0.1),
                    borderRadius: "50%",
                    background: "#FFE00055",
                  }}
                />
              );
            }
          } else {
            content = (
              <div
                style={{
                  width: Math.max(2, cellSize * 0.1),
                  height: Math.max(2, cellSize * 0.1),
                  borderRadius: "50%",
                  background: "#FFE00055",
                }}
              />
            );
          }
        } else if (meta.type === "home" && meta.player < playerCount) {
          const player = players[meta.player];
          background = player.home;
          border = `1px solid ${player.color}44`;
          content = (
            <div
              style={{
                width: Math.max(2, cellSize * 0.1),
                height: Math.max(2, cellSize * 0.1),
                borderRadius: "50%",
                background: player.color,
                opacity: 0.4,
              }}
            />
          );
        } else if (meta.type === "base" && meta.player < playerCount) {
          const player = players[meta.player];
          const basePos = PCFG[meta.player].basePos;
          const isSlot = basePos.some((slot) => slot.row === row && slot.col === col);
          const colMin = meta.player === 0 || meta.player === 3 ? 1 : 10;
          const colMax = colMin + 3;
          const rowMin = meta.player < 2 ? 1 : 10;
          const rowMax = rowMin + 3;
          const inside = row >= rowMin && row <= rowMax && col >= colMin && col <= colMax;

          background = inside ? player.home : `${player.color}11`;
          border = inside ? `1px solid ${player.color}33` : "none";

          if (isSlot) {
            background = "#0a0a15";
            border = `2px solid ${player.color}55`;
            shadow = `inset 0 0 6px ${player.color}22`;
          }
        } else if (meta.type === "center") {
          background = row === 7 && col === 7 ? "#FFE00022" : "#111122";
          border = "1px solid #FFE00033";
          if (showCenterCharacter && row === 7 && col === 7) {
            content = <PixelSprite character={centerCharacter} direction="right" size={Math.round(cellSize * 0.56)} />;
          }
        }

        return (
          <div
            key={`${row}-${col}`}
            style={{
              position: "absolute",
              left: col * cellSize,
              top: row * cellSize,
              width: cellSize,
              height: cellSize,
              background,
              border,
              boxShadow: shadow,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 2,
            }}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
});

BoardGrid.displayName = "BoardGrid";

export function getBoardSize(cellSize: number) {
  return cellSize * GRID;
}
