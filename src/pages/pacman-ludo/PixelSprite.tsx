import type { CSSProperties } from "react";

import type { CharacterDefinition, FacingDirection } from "../../lib/pac-ludo/types";

type PixelSpriteProps = {
  character: Pick<CharacterDefinition, "frames" | "previewFrame" | "rasterFrames">;
  direction?: FacingDirection;
  size: number;
  glow?: string;
  sweating?: boolean;
  style?: CSSProperties;
};

export function PixelSprite({ character, direction, size, glow, sweating = false, style }: PixelSpriteProps) {
  const resolvedDirection = direction ?? character.previewFrame;
  const frame = character.frames[resolvedDirection];
  const rows = frame.rows.length;
  const cols = Math.max(...frame.rows.map((row) => row.length));
  const raster = character.rasterFrames;
  const rasterFrameSrc = raster?.frameSrcByDirection[resolvedDirection];

  return (
    <div style={{ position: "relative", width: size, height: size, ...style }}>
      {rasterFrameSrc ? (
        <div
          style={{
            width: size,
            height: size,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            filter: glow ? `drop-shadow(0 0 5px ${glow})` : undefined,
            transform: "translateZ(0)",
            position: "relative",
          }}
        >
          <img
            src={rasterFrameSrc}
            alt=""
            draggable={false}
            style={{
              width: size,
              height: size,
              objectFit: "contain",
              imageRendering: "pixelated",
              userSelect: "none",
              pointerEvents: "none",
              display: "block",
            }}
          />
        </div>
      ) : (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${cols} ${rows}`}
          style={{
            display: "block",
            overflow: "visible",
            shapeRendering: "crispEdges",
            imageRendering: "pixelated",
            filter: glow ? `drop-shadow(0 0 5px ${glow})` : undefined,
          }}
        >
          {frame.rows.flatMap((row, y) =>
            row.split("").map((cell, x) => {
              if (cell === ".") return null;
              const fill = frame.palette[cell];
              if (!fill) return null;
              return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />;
            }),
          )}
        </svg>
      )}
      {sweating && (
        <>
          <div
            style={{
              position: "absolute",
              right: size * 0.04,
              top: size * 0.08,
              width: Math.max(2, size * 0.12),
              height: Math.max(3, size * 0.18),
              borderRadius: "999px",
              background: "#56c9ff",
              animation: "pacLudoDrop .8s infinite ease-in-out",
              opacity: 0.9,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: -size * 0.02,
              top: size * 0.22,
              width: Math.max(2, size * 0.1),
              height: Math.max(2, size * 0.14),
              borderRadius: "999px",
              background: "#56c9ff",
              animation: "pacLudoDrop 1.05s infinite ease-in-out",
              opacity: 0.7,
            }}
          />
        </>
      )}
    </div>
  );
}
