import React, { useState, useEffect, useCallback, useRef } from "react";

interface SpriteIcon {
  id: string;
  p: Record<number, string>;
  g: number[][];
}

interface SpritePack {
  id: string;
  name: string;
  color: string;
  sprites: SpriteIcon[];
}

interface Card {
  uid: number;
  iconId: string;
  matched: boolean;
}

type GridSize = { id: string; label: string; cols: number; rows: number; pairs: number; };


function PixelSprite({ grid, palette, size = 48 }: { grid: number[][], palette: Record<number, string>, size?: number }) {
const rows = grid.length, cols = grid[0].length;
return (
<svg width={size} height={size} viewBox={`0 0 ${cols} ${rows}`} style={{ imageRendering: "pixelated" }}>
{grid.map((row, y) => row.map((cell, x) =>
cell !== 0 ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={palette[cell]} /> : null
))}
</svg>
);
}

// ─── SPRITE PACKS ───
const PACKS: SpritePack[] = [
{ id: "pacman", name: "PAC-MAN", color: "#FFFF00", sprites: [
{ id: "pacman", p:{1:"#FFFF00"}, g:[[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0,0],[1,1,1,0,0,0,0,0,0],[1,1,1,1,0,0,0,0,0],[0,1,1,1,1,0,0,0,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,1,1,0,0,0]] },
{ id: "mspacman", p:{1:"#FFFF00",2:"#FF2266",3:"#2121DE"}, g:[[0,0,2,1,1,1,0,0,0],[0,2,1,1,1,1,1,0,0],[0,0,1,1,3,0,0,0,0],[0,1,1,1,0,0,0,0,0],[1,1,1,0,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,0,1,1,1,0,0,0,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,1,1,0,0,0]] },
{ id: "blinky", p:{1:"#FF0000",2:"#FFF",3:"#2121DE"}, g:[[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,2,2,1,2,2,1,0],[0,1,2,3,1,2,3,1,0],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,0,1,1,0,1,1,0,1]] },
{ id: "pinky", p:{1:"#FFB8FF",2:"#FFF",3:"#2121DE"}, g:[[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,2,2,1,2,2,1,0],[0,1,2,3,1,2,3,1,0],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,0,1,1,0,1,1,0,1]] },
{ id: "inky", p:{1:"#00FFFF",2:"#FFF",3:"#2121DE"}, g:[[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,2,2,1,2,2,1,0],[0,1,2,3,1,2,3,1,0],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,0,1,1,0,1,1,0,1]] },
{ id: "clyde", p:{1:"#FFB852",2:"#FFF",3:"#2121DE"}, g:[[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,2,2,1,2,2,1,0],[0,1,2,3,1,2,3,1,0],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,0,1,1,0,1,1,0,1]] },
{ id: "scared", p:{1:"#2121DE",2:"#FFB8FF"}, g:[[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0],[0,1,2,2,1,2,2,1,0],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,2,1,2,1,2,1,2,1],[1,1,1,1,1,1,1,1,1],[1,0,1,1,0,1,1,0,1]] },
{ id: "cherry", p:{1:"#FF0000",2:"#00AA00",3:"#FFB852"}, g:[[0,0,0,0,0,2,0,0,0],[0,0,0,0,2,0,0,0,0],[0,0,0,2,0,2,0,0,0],[0,0,2,0,0,0,2,0,0],[0,1,1,0,0,1,1,0,0],[1,1,1,1,0,1,1,1,0],[1,1,3,1,0,1,3,1,0],[1,1,1,1,0,1,1,1,0],[0,1,1,0,0,0,1,0,0]] },
{ id: "straw", p:{1:"#FF0000",2:"#00AA00",3:"#FFF"}, g:[[0,0,0,0,2,0,0,0,0],[0,0,0,2,2,2,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,1,3,1,3,1,0,0],[0,1,1,1,3,1,1,1,0],[0,1,3,1,1,1,3,1,0],[0,0,1,1,3,1,1,0,0],[0,0,0,1,1,1,0,0,0],[0,0,0,0,1,0,0,0,0]] },
{ id: "orange_f", p:{1:"#FFB852",2:"#00AA00"}, g:[[0,0,0,2,0,0,0,0,0],[0,0,0,0,2,0,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,1,1,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "apple", p:{1:"#FF0000",2:"#00AA00",3:"#FFF"}, g:[[0,0,0,0,2,0,0,0,0],[0,0,0,2,2,0,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,3,1,1,1,1,0],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,1,1,0,0,0]] },
{ id: "melon", p:{1:"#00CC00",2:"#AAFFAA"}, g:[[0,0,0,1,1,1,0,0,0],[0,0,1,2,1,2,1,0,0],[0,1,1,1,2,1,1,1,0],[1,2,1,1,1,1,1,2,1],[1,1,1,1,1,1,1,1,1],[1,1,2,1,1,1,2,1,1],[0,1,1,1,2,1,1,1,0],[0,0,1,2,1,2,1,0,0],[0,0,0,1,1,1,0,0,0]] },
{ id: "key", p:{1:"#FFFF00",2:"#FFB852"}, g:[[0,0,1,1,1,0,0,0,0],[0,1,2,2,2,1,0,0,0],[0,1,2,0,2,1,0,0,0],[0,1,2,2,2,1,0,0,0],[0,0,1,1,1,0,0,0,0],[0,0,0,1,0,0,0,0,0],[0,0,0,1,1,0,0,0,0],[0,0,0,1,0,0,0,0,0],[0,0,0,1,1,1,0,0,0]] },
{ id: "bell", p:{1:"#FFFF00",2:"#FFB852"}, g:[[0,0,0,0,1,0,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,1,2,1,2,1,0,0],[0,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,0],[0,0,0,0,2,0,0,0,0]] },
{ id: "star_pm", p:{1:"#FFFF00"}, g:[[0,0,0,0,1,0,0,0,0],[0,0,0,0,1,0,0,0,0],[0,0,0,1,1,1,0,0,0],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,0,0],[0,0,1,1,0,1,1,0,0],[0,1,1,0,0,0,1,1,0],[0,1,0,0,0,0,0,1,0]] },
{ id: "pellet", p:{1:"#FFB8AE"}, g:[[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,1,1,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "pretzel", p:{1:"#FFB852",2:"#CC8833"}, g:[[0,0,1,1,1,1,1,0,0],[0,1,2,0,0,0,2,1,0],[1,2,0,0,0,0,0,2,1],[0,1,2,0,0,0,2,1,0],[0,0,1,1,1,1,1,0,0],[0,1,2,0,0,0,2,1,0],[1,2,0,0,0,0,0,2,1],[0,1,2,0,0,0,2,1,0],[0,0,1,1,1,1,1,0,0]] },
]},
{ id: "invaders", name: "INVADERS", color: "#00FF00", sprites: [
{ id: "inv1", p:{1:"#00FF00"}, g:[[0,0,1,0,0,0,1,0,0],[0,0,0,1,0,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,0,1,0,1,1,0],[1,1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,0,1],[1,0,1,0,0,0,1,0,1],[0,0,0,1,0,1,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "inv2", p:{1:"#FF44FF"}, g:[[0,0,0,0,1,0,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,0,1,0,1,1,0],[0,1,1,1,1,1,1,1,0],[0,0,0,1,0,1,0,0,0],[0,0,1,0,0,0,1,0,0],[0,1,0,0,0,0,0,1,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "inv3", p:{1:"#AAAAFF"}, g:[[0,0,0,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,0],[1,1,1,0,1,0,1,1,1],[1,1,1,1,1,1,1,1,1],[0,0,1,0,0,0,1,0,0],[0,1,0,1,0,1,0,1,0],[1,0,0,0,0,0,0,0,1],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "inv_ufo", p:{1:"#FF0000",2:"#FF8888"}, g:[[0,0,0,0,0,0,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,2,1,2,1,2,1,0],[1,1,1,1,1,1,1,1,1],[0,0,1,0,1,0,1,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "inv_ship", p:{1:"#00FF00",2:"#88FF88"}, g:[[0,0,0,0,0,0,0,0,0],[0,0,0,0,1,0,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,0,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "inv_barrier", p:{1:"#00CC00"}, g:[[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,0,0,0,1,1,1],[1,1,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
]},
{ id: "tetris", name: "TETRIS", color: "#AA00FF", sprites: [
{ id: "tblock", p:{1:"#AA00FF",2:"#CC66FF"}, g:[[0,0,0,0,0,0,0,0,0],[0,0,1,1,1,1,1,0,0],[0,0,1,2,1,2,1,0,0],[0,0,1,1,1,1,1,0,0],[0,0,0,0,1,0,0,0,0],[0,0,0,0,1,0,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,0,1,2,1,0,0,0],[0,0,0,1,1,1,0,0,0]] },
{ id: "lblock", p:{1:"#FF8800",2:"#FFBB66"}, g:[[0,0,1,1,1,0,0,0,0],[0,0,1,2,1,0,0,0,0],[0,0,1,1,1,0,0,0,0],[0,0,1,1,1,0,0,0,0],[0,0,1,2,1,0,0,0,0],[0,0,1,1,1,1,1,0,0],[0,0,1,2,1,2,1,0,0],[0,0,1,1,1,1,1,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "sblock", p:{1:"#00CC00",2:"#66FF66"}, g:[[0,0,0,0,0,0,0,0,0],[0,0,0,1,1,1,1,0,0],[0,0,0,1,2,1,2,0,0],[0,0,0,1,1,1,1,0,0],[0,0,1,1,1,1,0,0,0],[0,0,1,2,1,2,0,0,0],[0,0,1,1,1,1,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "iblock", p:{1:"#00DDDD",2:"#88FFFF"}, g:[[0,0,0,0,0,0,0,0,0],[0,1,1,1,1,1,1,1,0],[0,1,2,1,2,1,2,1,0],[0,1,1,1,1,1,1,1,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "oblock", p:{1:"#FFDD00",2:"#FFEE66"}, g:[[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,1,1,1,1,1,0,0],[0,0,1,2,1,2,1,0,0],[0,0,1,1,1,1,1,0,0],[0,0,1,2,1,2,1,0,0],[0,0,1,1,1,1,1,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "zblock", p:{1:"#FF2222",2:"#FF8888"}, g:[[0,0,0,0,0,0,0,0,0],[0,0,1,1,1,1,0,0,0],[0,0,1,2,1,2,0,0,0],[0,0,1,1,1,1,0,0,0],[0,0,0,1,1,1,1,0,0],[0,0,0,1,2,1,2,0,0],[0,0,0,1,1,1,1,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "jblock", p:{1:"#2222FF",2:"#8888FF"}, g:[[0,0,0,0,1,1,1,0,0],[0,0,0,0,1,2,1,0,0],[0,0,0,0,1,1,1,0,0],[0,0,0,0,1,1,1,0,0],[0,0,0,0,1,2,1,0,0],[0,0,1,1,1,1,1,0,0],[0,0,1,2,1,2,1,0,0],[0,0,1,1,1,1,1,0,0],[0,0,0,0,0,0,0,0,0]] },
]},
{ id: "arcade", name: "ARCADE", color: "#FF6600", sprites: [
{ id: "galaga", p:{1:"#FFF",2:"#FF0000",3:"#00AAFF"}, g:[[0,0,0,0,1,0,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,0,1,2,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,3,1,1,1,3,1,0],[1,1,1,1,1,1,1,1,1],[1,0,0,1,1,1,0,0,1],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "galaga_e", p:{1:"#FFFF00",2:"#FF0000",3:"#00CC00"}, g:[[0,0,0,1,1,1,0,0,0],[0,0,1,2,1,2,1,0,0],[0,1,1,1,1,1,1,1,0],[1,3,1,3,1,3,1,3,1],[1,1,1,1,1,1,1,1,1],[0,1,0,1,0,1,0,1,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "frog", p:{1:"#00CC00",2:"#AAFFAA",3:"#FF0000"}, g:[[0,3,0,0,0,0,0,3,0],[1,1,1,0,0,0,1,1,1],[0,1,2,1,1,1,2,1,0],[0,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0],[0,1,0,1,0,1,0,1,0],[0,1,0,0,0,0,0,1,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "digdug", p:{1:"#FFF",2:"#4488FF",3:"#FFB852"}, g:[[0,0,0,1,1,1,0,0,0],[0,0,1,3,1,3,1,0,0],[0,0,1,1,1,1,1,0,0],[0,0,0,2,2,2,0,0,0],[0,0,2,2,1,2,2,0,0],[0,0,0,2,2,2,0,0,0],[0,0,0,2,0,2,0,0,0],[0,0,2,2,0,2,2,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "qbert", p:{1:"#FF6600",2:"#FFCC00",3:"#FFF"}, g:[[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,3,3,1,3,3,1,0],[0,1,1,1,1,1,1,1,0],[0,0,1,2,2,2,1,0,0],[0,0,0,1,1,1,0,0,0],[0,0,1,0,1,0,1,0,0],[0,0,1,0,0,0,1,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "pong", p:{1:"#FFF"}, g:[[0,0,0,0,1,0,0,0,0],[0,0,0,0,0,0,0,0,0],[1,1,0,0,0,0,0,0,0],[1,1,0,0,0,0,0,0,0],[1,1,0,0,1,0,0,1,1],[1,1,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1],[0,0,0,0,1,0,0,0,0]] },
{ id: "asteroid", p:{1:"#AAA",2:"#666"}, g:[[0,0,0,1,1,0,0,0,0],[0,0,1,1,1,1,0,0,0],[0,1,1,2,1,1,1,0,0],[1,1,2,2,1,1,1,1,0],[1,1,1,1,1,2,1,1,0],[0,1,1,1,2,2,1,0,0],[0,0,1,1,1,1,0,0,0],[0,0,0,1,1,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "centipede", p:{1:"#00CC00",2:"#FF4400",3:"#FFFF00"}, g:[[0,0,0,0,0,0,0,0,0],[0,0,1,1,0,1,1,0,0],[0,1,3,1,1,1,3,1,0],[0,1,1,2,1,2,1,1,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,0,1,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "defender", p:{1:"#FFF",2:"#00AAFF",3:"#FF4400"}, g:[[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,1,0,0,0,0,0],[3,3,1,1,1,1,1,1,0],[0,1,1,2,2,2,1,1,1],[3,3,1,1,1,1,1,1,0],[0,0,0,1,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "breakout", p:{1:"#FFF",2:"#FF0000",3:"#FFFF00"}, g:[[0,2,2,2,2,2,2,2,0],[0,3,3,3,3,3,3,3,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,1,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,0]] },
]},
{ id: "nintendo", name: "NINTENDO", color: "#FF2222", sprites: [
{ id: "mushroom", p:{1:"#FF0000",2:"#FFF",3:"#FFB852"}, g:[[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,2,1,2,1,1,0],[1,1,2,2,1,2,2,1,1],[1,1,1,1,1,1,1,1,1],[0,0,3,3,3,3,3,0,0],[0,0,3,2,3,2,3,0,0],[0,0,3,3,3,3,3,0,0],[0,0,0,3,3,3,0,0,0]] },
{ id: "fireflower", p:{1:"#FF4400",2:"#FFFF00",3:"#00AA00"}, g:[[0,0,0,2,2,0,0,0,0],[0,0,2,2,2,2,0,0,0],[0,1,1,2,2,1,1,0,0],[0,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,0,0,0],[0,0,0,3,3,0,0,0,0],[0,0,0,3,3,0,0,0,0],[0,0,3,3,3,3,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "coin", p:{1:"#FFDD00",2:"#FFB800"}, g:[[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,2,1,2,1,1,0],[0,1,1,1,2,1,1,1,0],[0,1,1,1,2,1,1,1,0],[0,1,1,2,1,2,1,1,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,1,1,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "barrel", p:{1:"#BB6622",2:"#FFCC66",3:"#884400"}, g:[[0,0,1,1,1,1,1,0,0],[0,1,2,2,2,2,2,1,0],[1,3,2,3,2,3,2,3,1],[1,2,2,2,2,2,2,2,1],[1,3,2,3,2,3,2,3,1],[1,2,2,2,2,2,2,2,1],[1,3,2,3,2,3,2,3,1],[0,1,2,2,2,2,2,1,0],[0,0,1,1,1,1,1,0,0]] },
{ id: "duck", p:{1:"#00AA00",2:"#FFDD00",3:"#FF6600"}, g:[[0,0,0,1,1,0,0,0,0],[0,0,1,1,1,0,0,0,0],[0,0,1,1,1,3,3,0,0],[0,1,1,1,3,3,3,3,0],[0,1,2,1,1,0,0,0,0],[0,0,1,1,1,0,0,0,0],[0,0,1,0,1,0,0,0,0],[0,1,1,0,1,1,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "mstar", p:{1:"#FFFF00",2:"#FFF"}, g:[[0,0,0,0,0,0,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,1,1,2,1,1,0,0],[0,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,0],[0,0,1,1,2,1,1,0,0],[0,0,0,1,1,1,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "shell", p:{1:"#00CC00",2:"#FFFF00",3:"#FFF"}, g:[[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,3,1,2,1,3,1,0],[0,1,1,1,2,1,1,1,0],[1,1,1,1,2,1,1,1,1],[0,1,1,1,1,1,1,1,0],[0,0,2,2,2,2,2,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "pipe", p:{1:"#00AA00",2:"#00DD00"}, g:[[0,1,1,1,1,1,1,1,0],[0,1,2,2,2,2,2,1,0],[0,1,1,1,1,1,1,1,0],[0,0,1,2,2,2,1,0,0],[0,0,1,2,2,2,1,0,0],[0,0,1,2,2,2,1,0,0],[0,0,1,2,2,2,1,0,0],[0,0,1,2,2,2,1,0,0],[0,0,1,1,1,1,1,0,0]] },
]},
{ id: "extras", name: "EXTRAS", color: "#FF88AA", sprites: [
{ id: "bomb", p:{1:"#333",2:"#666",3:"#FF4400"}, g:[[0,0,0,0,0,3,0,0,0],[0,0,0,0,3,0,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,1,2,1,1,1,0,0],[0,1,1,1,1,1,1,1,0],[0,1,2,1,1,1,2,1,0],[0,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,1,1,0,0,0]] },
{ id: "skull", p:{1:"#FFF",2:"#888"}, g:[[0,0,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0],[1,1,2,1,1,1,2,1,1],[1,1,2,1,1,1,2,1,1],[0,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,0,0],[0,0,1,2,1,2,1,0,0],[0,0,0,1,1,1,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "heart", p:{1:"#FF2266",2:"#FF88AA"}, g:[[0,0,0,0,0,0,0,0,0],[0,1,1,0,0,1,1,0,0],[1,1,2,1,1,1,2,1,0],[1,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,0,0,0],[0,0,0,1,1,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "crown", p:{1:"#FFDD00",2:"#FF4400"}, g:[[0,0,0,0,0,0,0,0,0],[0,1,0,0,1,0,0,1,0],[0,1,1,0,1,0,1,1,0],[0,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,0],[0,1,2,1,2,1,2,1,0],[0,1,1,1,1,1,1,1,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "diamond", p:{1:"#44DDFF",2:"#AAEEFF"}, g:[[0,0,0,0,1,0,0,0,0],[0,0,0,1,2,1,0,0,0],[0,0,1,2,1,2,1,0,0],[0,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,1,1,0,0,0],[0,0,0,0,1,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "lightning", p:{1:"#FFFF00",2:"#FFAA00"}, g:[[0,0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0,0],[0,0,1,1,1,0,0,0,0],[0,1,1,2,1,1,1,0,0],[0,0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0,0],[0,0,1,1,0,0,0,0,0],[0,1,1,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]] },
{ id: "shield", p:{1:"#4488FF",2:"#FFF",3:"#FFDD00"}, g:[[0,1,1,1,1,1,1,1,0],[1,1,2,1,1,1,2,1,1],[1,1,1,1,3,1,1,1,1],[1,1,1,3,3,3,1,1,1],[1,1,1,1,3,1,1,1,1],[0,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,1,1,0,0,0],[0,0,0,0,1,0,0,0,0]] },
{ id: "potion", p:{1:"#AA00FF",2:"#CC66FF",3:"#888"}, g:[[0,0,0,3,3,3,0,0,0],[0,0,0,0,3,0,0,0,0],[0,0,0,3,3,3,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,2,1,2,1,1,0],[0,1,1,1,2,1,1,1,0],[0,1,1,2,1,2,1,1,0],[0,0,1,1,1,1,1,0,0],[0,0,0,0,0,0,0,0,0]] },
]},
];

function shuffle<T>(a: T[]): T[] {const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}

const GRID_SIZES: GridSize[] = [
{ id: "s", label: "CHICO", cols: 4, rows: 4, pairs: 8 },
{ id: "m", label: "MEDIO", cols: 4, rows: 6, pairs: 12 },
{ id: "l", label: "GRANDE", cols: 5, rows: 8, pairs: 20 },
{ id: "xl", label: "INMENSO", cols: 6, rows: 9, pairs: 27 },
];

function createDeck(packIds: string[], pairCount: number): { cards: Card[], icons: SpriteIcon[] } {
const pool: SpriteIcon[] = [];
PACKS.forEach(pk => { if (packIds.includes(pk.id)) pool.push(...pk.sprites); });
const sel = shuffle(pool).slice(0, pairCount);
const pairs: Card[] = [];
sel.forEach((icon, idx) => {
pairs.push({ uid: idx*2, iconId: icon.id, matched: false });
pairs.push({ uid: idx*2+1, iconId: icon.id, matched: false });
});
return { cards: shuffle(pairs), icons: sel };
}

function getSpriteCount(packIds: string[]): number {
let n = 0; PACKS.forEach(p => { if (packIds.includes(p.id)) n += p.sprites.length; }); return n;
}

const ALL_PLAYERS = [
{ name: "Facu", color: "#00DD00" },
{ name: "Dai", color: "#FF2222" },
{ name: "Can", color: "#4488FF" },
];

const PREVIEW_TIMES = { s: 4000, m: 6000, l: 8000, xl: 12000 };
const MISMATCH_TIME = 900;
const PH = { START: "start", PREVIEW: "preview", PLAYING: "playing", GAMEOVER: "gameover" };
const FF = "'Press Start 2P', monospace";
const GAP = 3; const BORDER = 2;
const SCORES_H = 46; const HEADER_H = 34; const RESTART_H = 22;

const btnBase = { fontFamily: FF, cursor: "pointer", letterSpacing: 2, transition: "all 0.2s", background: "transparent" };

function StartScreen({ onStart }: { onStart: (players: number[], starterIdx: number, packIds: string[], sizeId: string) => void }) {
const [selPlayers, setSelPlayers] = useState([0, 1]);
const [selPacks, setSelPacks] = useState(["pacman"]);
const [gridSize, setGridSize] = useState("l");
const [starter, setStarter] = useState<number|null>(null);
const [rolling, setRolling] = useState(false);
const [rollDisplay, setRollDisplay] = useState<number|null>(null);
const [step, setStep] = useState(1);

const gs = GRID_SIZES.find(g => g.id === gridSize) ?? GRID_SIZES[2];
const spriteCount = getSpriteCount(selPacks);
const enoughSprites = spriteCount >= gs.pairs;

const togglePlayer = (idx: number) => setSelPlayers(p => p.includes(idx) ? (p.length<=2?p:p.filter(i=>i!==idx)) : [...p,idx].sort());
const togglePack = (id: string) => setSelPacks(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]);

const handleRandom = () => {
setRolling(true); setStarter(null); setRollDisplay(null);
let c = 0;
const iv = setInterval(() => {
setRollDisplay(selPlayers[c%selPlayers.length]); c++;
if(c>14){clearInterval(iv);const pick=selPlayers[Math.floor(Math.random()*selPlayers.length)];setRollDisplay(pick);setRolling(false);setStarter(pick);}
}, 100);
};

const scrollBox: React.CSSProperties = { display:"flex",flexDirection:"column",gap:7,width:"100%",maxWidth:280,overflowY:"auto",maxHeight:"35vh",paddingRight:4 };

return (
<div style={{ position:"fixed",inset:0,background:"#000",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:60,fontFamily:FF,gap:"1.8vh",padding:"14px 20px",overflowY:"auto" }}>
<h1 style={{ fontSize:"clamp(14px,4vw,22px)",margin:0,flexShrink:0,textShadow:"0 0 10px #FFD700",letterSpacing:3 }}>
<span style={{color:"#FFFF00"}}>PAC</span><span style={{color:"#fff"}}>-</span><span style={{color:"#FF6600"}}>MEMORY</span>
</h1>

  {step===1&&(<>
    <div style={{color:"#FFB8AE",fontSize:8,letterSpacing:1}}>¿QUIÉNES JUEGAN?</div>
    <div style={scrollBox}>
      {ALL_PLAYERS.map((pl,i)=>{const on=selPlayers.includes(i);return(
        <button key={pl.name} onClick={()=>togglePlayer(i)} style={{...btnBase,fontSize:11,padding:"10px 14px",color:on?pl.color:"#444",border:`2px solid ${on?pl.color:"#333"}`,textShadow:on?`0 0 8px ${pl.color}`:"none",display:"flex",justifyContent:"space-between"}}>
          <span>{pl.name}</span><span style={{fontSize:8}}>{on?"✓":""}</span>
        </button>);})}
    </div>
    <button onClick={()=>setStep(2)} disabled={selPlayers.length<2} style={{...btnBase,fontSize:11,padding:"10px 22px",color:selPlayers.length>=2?"#FFFF00":"#333",border:`2px solid ${selPlayers.length>=2?"#FFFF00":"#222"}`,textShadow:selPlayers.length>=2?"0 0 6px #FFFF00":"none",cursor:selPlayers.length>=2?"pointer":"default"}}>SIGUIENTE ▶</button>
  </>)}

  {step===2&&(<>
    <div style={{color:"#FFB8AE",fontSize:8,letterSpacing:1,textAlign:"center"}}>TAMAÑO Y PAQUETES</div>
    {/* Grid size */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,width:"100%",maxWidth:280}}>
      {GRID_SIZES.map(sz=>{const on=gridSize===sz.id;return(
        <button key={sz.id} onClick={()=>setGridSize(sz.id)} style={{...btnBase,fontSize:8,padding:"7px 4px",color:on?"#FFFF00":"#555",border:`2px solid ${on?"#FFFF00":"#333"}`,textShadow:on?"0 0 6px #FFFF00":"none",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <span>{sz.label}</span>
          <span style={{fontSize:6,color:on?"#AAA":"#444"}}>{sz.cols}×{sz.rows} ({sz.pairs}p)</span>
        </button>);})}
    </div>
    {/* Packs */}
    <div style={{...scrollBox,maxHeight:"28vh"}}>
      {PACKS.map(pack=>{const on=selPacks.includes(pack.id);return(
        <button key={pack.id} onClick={()=>togglePack(pack.id)} style={{...btnBase,fontSize:8,padding:"7px 10px",color:on?pack.color:"#444",border:`2px solid ${on?pack.color:"#333"}`,textShadow:on?`0 0 6px ${pack.color}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <PixelSprite grid={pack.sprites[0].g} palette={pack.sprites[0].p} size={20} />
            <span>{pack.name}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:6,color:on?"#888":"#333"}}>{pack.sprites.length}</span>
            <span style={{fontSize:7}}>{on?"✓":""}</span>
          </div>
        </button>);})}
    </div>
    <div style={{fontSize:7,color:enoughSprites?"#888":"#f44",letterSpacing:1,textAlign:"center"}}>
      {spriteCount}/{gs.pairs} sprites {enoughSprites?"✓":`(faltan ${gs.pairs-spriteCount})`}
    </div>
    <div style={{display:"flex",gap:10}}>
      <button onClick={()=>setStep(1)} style={{...btnBase,fontSize:9,color:"#666",border:"1px solid #444",padding:"8px 14px"}}>◀</button>
      <button onClick={()=>setStep(3)} disabled={!enoughSprites} style={{...btnBase,fontSize:11,padding:"10px 22px",color:enoughSprites?"#FFFF00":"#333",border:`2px solid ${enoughSprites?"#FFFF00":"#222"}`,textShadow:enoughSprites?"0 0 6px #FFFF00":"none",cursor:enoughSprites?"pointer":"default"}}>SIGUIENTE ▶</button>
    </div>
  </>)}

  {step===3&&(<>
    <div style={{color:"#FFB8AE",fontSize:8,letterSpacing:1}}>¿QUIÉN EMPIEZA?</div>
    <div style={scrollBox}>
      {selPlayers.map(i=>{const pl=ALL_PLAYERS[i];const on=starter===i&&!rolling;return(
        <button key={pl.name} onClick={()=>{setStarter(i);setRolling(false);setRollDisplay(null);}} style={{...btnBase,fontSize:11,padding:"10px 14px",color:pl.color,border:`2px solid ${on?pl.color:"#333"}`,textShadow:on?`0 0 8px ${pl.color}`:"none"}}>{pl.name}</button>);})}
      <button onClick={handleRandom} disabled={rolling} style={{...btnBase,fontSize:10,padding:"10px 14px",color:rolling?"#FFFF00":"#FFB852",border:`2px solid ${rolling?"#FFFF00":"#444"}`,cursor:rolling?"default":"pointer"}}>{rolling?"...":"🎲 AL AZAR"}</button>
    </div>
    {rollDisplay!==null&&!rolling&&(
      <div style={{color:ALL_PLAYERS[rollDisplay].color,fontSize:11,textShadow:`0 0 10px ${ALL_PLAYERS[rollDisplay].color}`,animation:"fadeIn 0.3s",letterSpacing:2}}>¡EMPIEZA {ALL_PLAYERS[rollDisplay].name.toUpperCase()}!</div>
    )}
    <div style={{display:"flex",gap:10}}>
      <button onClick={()=>{setStep(2);setStarter(null);setRollDisplay(null);}} style={{...btnBase,fontSize:9,color:"#666",border:"1px solid #444",padding:"8px 14px"}}>◀</button>
      {starter!==null&&!rolling&&(
        <button onClick={()=>onStart(selPlayers,starter,selPacks,gridSize)} style={{...btnBase,fontSize:11,color:"#0f0",border:"2px solid #0f0",padding:"10px 22px",textShadow:"0 0 8px #0f0",animation:"fadeIn 0.3s"}}>▶ JUGAR</button>
      )}
    </div>
  </>)}
</div>

);
}

const STYLE_CSS = "@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'); @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}} @keyframes fadeIn{from{opacity:0}to{opacity:1}} *{box-sizing:border-box;margin:0;padding:0} html,body{background:#000;overflow:hidden;height:100%}";

export default function PacManMemory() {
const [deck, setDeck] = useState<{cards:Card[], icons:SpriteIcon[]}>({cards:[],icons:[]});
const [phase, setPhase] = useState(PH.START);
const [activePlayers, setActivePlayers] = useState([0,1]);
const [turnIdx, setTurnIdx] = useState(0);
const [scores, setScores] = useState<Record<number,number>>({});
const [flipped, setFlipped] = useState<number[]>([]);
const [locked, setLocked] = useState(false);
const [previewCD, setPreviewCD] = useState(0);
const [matchAnim, setMatchAnim] = useState<string|null>(null);
const [lastResult, setLastResult] = useState<string|null>(null);
const [gs, setGs] = useState<GridSize>(GRID_SIZES[2]);
const timerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
const [cellSize, setCellSize] = useState(50);

const cards = deck.cards;
const icons = deck.icons;
const curPI = activePlayers[turnIdx%activePlayers.length];
const curP = ALL_PLAYERS[curPI];
const getIcon = (id: string) => icons.find(i=>i.id===id);

useEffect(()=>{
const calc=()=>{
const vh=(window.visualViewport?.height) ?? window.innerHeight;
const vw=Math.min(window.innerWidth,480);
setCellSize(Math.floor(Math.min(
(vh-SCORES_H-HEADER_H-RESTART_H-6-(gs.rows-1)*GAP)/gs.rows,
(vw-16-(gs.cols-1)*GAP)/gs.cols
)));
};
calc();
window.addEventListener("resize",calc);
window.visualViewport?.addEventListener("resize",calc);
return()=>{window.removeEventListener("resize",calc);window.visualViewport?.removeEventListener("resize",calc);};
},[gs]);

const spriteSize=Math.max(16,Math.floor(cellSize*0.68));
const gridW=cellSize*gs.cols+GAP*(gs.cols-1);
const gridH=cellSize*gs.rows+GAP*(gs.rows-1);

const handleStart=(players: number[],starterIdx: number,packIds: string[],sizeId: string)=>{
const g=GRID_SIZES.find(x=>x.id===sizeId) ?? GRID_SIZES[2];
setGs(g);
setActivePlayers(players);
const sc: Record<number,number>={};players.forEach((i: number)=>sc[i]=0);setScores(sc);
setTurnIdx(players.indexOf(starterIdx));
setDeck(createDeck(packIds,g.pairs));
const pt=(PREVIEW_TIMES as Record<string,number>)[sizeId]||6000;
setPreviewCD(Math.ceil(pt/1000));
setPhase(PH.PREVIEW);
};

useEffect(()=>{
if(phase!==PH.PREVIEW) return;
const iv=setInterval(()=>{setPreviewCD(c=>{if(c<=1){clearInterval(iv);setPhase(PH.PLAYING);return 0;}return c-1;});},1000);
return()=>clearInterval(iv);
},[phase]);

useEffect(()=>{
if(cards.length>0&&cards.filter(c=>c.matched).length===cards.length&&phase===PH.PLAYING)
setTimeout(()=>setPhase(PH.GAMEOVER),600);
},[cards,phase]);

const handleCardClick=useCallback((uid: number)=>{
if(phase!==PH.PLAYING||locked) return;
const card=cards.find(c=>c.uid===uid);
if(!card||card.matched||flipped.includes(uid)) return;
const nf=[...flipped,uid];
setFlipped(nf);
if(nf.length===2){
setLocked(true);
const [a,b]=nf.map(u=>cards.find((c: Card)=>c.uid===u)) as [Card, Card];
if(a.iconId===b.iconId){
setMatchAnim(a.iconId);setLastResult("match");
timerRef.current=setTimeout(()=>{
setDeck(prev=>({...prev,cards:prev.cards.map(c=>c.uid===a.uid||c.uid===b.uid?{...c,matched:true}:c)}));
setScores(p=>({...p,[curPI]:p[curPI]+1}));
setFlipped([]);setLocked(false);setMatchAnim(null);setLastResult(null);
},MISMATCH_TIME);
} else {
setLastResult("miss");
timerRef.current=setTimeout(()=>{
setFlipped([]);setLocked(false);
setTurnIdx((t: number)=>(t+1)%activePlayers.length);setLastResult(null);
},MISMATCH_TIME);
}
}
},[phase,locked,cards,flipped,curPI,activePlayers]);

const restart=()=>{
if (timerRef.current) clearTimeout(timerRef.current);
setPhase(PH.START);setFlipped([]);setLocked(false);
setMatchAnim(null);setLastResult(null);
};

const isVis=(c: Card)=>phase===PH.PREVIEW||c.matched||flipped.includes(c.uid);

let winners: number[] = [];
if(phase===PH.GAMEOVER){const mx=Math.max(...activePlayers.map(i=>scores[i]));winners=activePlayers.filter(i=>scores[i]===mx);}

return (
<div style={{height:"100dvh",background:"#000",display:"flex",flexDirection:"column",alignItems:"center",fontFamily:FF,position:"relative",overflow:"hidden",maxWidth:480,margin:"0 auto"}}>
<style>{STYLE_CSS}</style>
<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"repeating-linear-gradient(0deg,rgba(0,0,0,0.1) 0px,rgba(0,0,0,0.1) 1px,transparent 1px,transparent 3px)",pointerEvents:"none",zIndex:100}} />

  {phase===PH.START&&<StartScreen onStart={handleStart} />}

  {/* SCORES */}
  <div style={{width:"100%",height:SCORES_H,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",gap:4,padding:"0 6px",borderBottom:"2px solid #222"}}>
    {activePlayers.map(i=>{const pl=ALL_PLAYERS[i];const act=curPI===i&&phase===PH.PLAYING;return(
      <div key={pl.name} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"4px 2px",background:act?`${pl.color}12`:"transparent",borderBottom:act?`3px solid ${pl.color}`:"3px solid transparent",transition:"all 0.3s",gap:1}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          {act&&<span style={{color:pl.color,fontSize:6,animation:"blink 0.6s infinite"}}>▶</span>}
          <span style={{color:act?pl.color:"#555",fontSize:"clamp(7px,1.8vw,10px)",letterSpacing:1}}>{pl.name}</span>
        </div>
        <span style={{color:"#fff",fontSize:"clamp(16px,4vw,22px)",textShadow:act?`0 0 10px ${pl.color}`:"none"}}>{scores[i]??0}</span>
      </div>);})}
  </div>

  {/* HEADER */}
  <div style={{height:HEADER_H,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
    {phase===PH.PREVIEW&&(<div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#0f0",fontSize:8,animation:"blink 0.6s infinite"}}>¡MEMORIZÁ!</span><span style={{color:"#FFFF00",fontSize:16,textShadow:"0 0 8px #FFFF00"}}>{previewCD}</span></div>)}
    {lastResult&&phase===PH.PLAYING&&(<div style={{fontSize:10,letterSpacing:3,color:lastResult==="match"?"#0f0":"#f44",textShadow:"0 0 6px currentColor",animation:"blink 0.3s ease 2"}}>{lastResult==="match"?"¡MATCH!":"¡NOPE!"}</div>)}
    {phase===PH.PLAYING&&!lastResult&&(<div style={{fontSize:9,color:curP.color,letterSpacing:1,opacity:0.6}}>TURNO: {curP.name.toUpperCase()}</div>)}
    {phase!==PH.PREVIEW&&phase!==PH.PLAYING&&(<div style={{fontSize:11,letterSpacing:3,textShadow:"0 0 6px #FFD700"}}><span style={{color:"#FFFF00"}}>PAC</span><span style={{color:"#fff"}}>-</span><span style={{color:"#FF6600"}}>MEMORY</span></div>)}
  </div>

  {/* GRID */}
  <div style={{width:gridW,height:gridH,flexShrink:0,display:"grid",gridTemplateColumns:`repeat(${gs.cols}, ${cellSize}px)`,gridTemplateRows:`repeat(${gs.rows}, ${cellSize}px)`,gap:GAP}}>
    {cards.map(card=>{const visible=isVis(card);const icon=getIcon(card.iconId);const isM=card.matched;const isMA=matchAnim===card.iconId&&flipped.includes(card.uid);return(
      <div key={card.uid} onClick={()=>handleCardClick(card.uid)} style={{width:cellSize,height:cellSize,cursor:"pointer",perspective:600,opacity:isM&&phase!==PH.PREVIEW?0.2:1,transform:isMA?"scale(1.06)":"scale(1)",transition:"transform 0.3s, opacity 0.5s"}}>
        <div style={{width:"100%",height:"100%",position:"relative",transformStyle:"preserve-3d",transition:"transform 0.4s cubic-bezier(0.4,0,0.2,1)",transform:visible?"rotateY(0deg)":"rotateY(180deg)"}}>
          <div style={{position:"absolute",width:"100%",height:"100%",backfaceVisibility:"hidden",background:"#000",border:`${BORDER}px solid #2121DE`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {icon&&<PixelSprite grid={icon.g} palette={icon.p} size={spriteSize} />}
            {isM&&phase!==PH.PREVIEW&&(<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#0f0",background:"rgba(0,0,0,0.4)"}}>✓</div>)}
          </div>
          <div style={{position:"absolute",width:"100%",height:"100%",backfaceVisibility:"hidden",transform:"rotateY(180deg)",background:"#000",border:`${BORDER}px solid #2121DE`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#FFB8AE"}} />
          </div>
        </div>
      </div>);})}
  </div>

  {/* RESTART */}
  <div style={{height:RESTART_H,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
    {phase!==PH.GAMEOVER&&phase!==PH.START&&(<button onClick={restart} style={{fontFamily:FF,fontSize:6,background:"transparent",color:"#444",border:"1px solid #333",padding:"3px 8px",cursor:"pointer",letterSpacing:1}}>REINICIAR</button>)}
  </div>

  {/* GAME OVER */}
  {phase===PH.GAMEOVER&&(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:60,animation:"fadeIn 0.5s"}}>
      <div style={{background:"#000",border:"3px solid #2121DE",padding:"24px 28px",textAlign:"center",boxShadow:"0 0 40px rgba(33,33,222,0.3)",maxWidth:"88vw"}}>
        <h2 style={{color:"#FFFF00",fontSize:18,margin:"0 0 16px",textShadow:"0 0 12px #FFFF00",letterSpacing:4}}>GAME OVER</h2>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14,alignItems:"center"}}>
          {activePlayers.map(i=>(<div key={i} style={{color:ALL_PLAYERS[i].color,fontSize:13,letterSpacing:1,display:"flex",gap:12,alignItems:"baseline"}}><span>{ALL_PLAYERS[i].name}</span><span style={{color:"#fff",fontSize:20}}>{scores[i]}</span></div>))}
        </div>
        <div style={{color:"#fff",fontSize:12,marginBottom:20,textShadow:"0 0 8px rgba(255,255,255,0.4)"}}>
          {winners.length===1?<>🏆 ¡<span style={{color:ALL_PLAYERS[winners[0]].color}}>{ALL_PLAYERS[winners[0]].name}</span> GANA! 🏆</>
          :winners.length===activePlayers.length?"¡EMPATE TOTAL! 🤝"
          :<>¡EMPATE: {winners.map((w,i)=><span key={w}><span style={{color:ALL_PLAYERS[w].color}}>{ALL_PLAYERS[w].name}</span>{i<winners.length-1?" y ":""}</span>)}! 🤝</>}
        </div>
        <button onClick={restart} style={{fontFamily:FF,fontSize:10,background:"transparent",color:"#0f0",border:"2px solid #0f0",padding:"10px 22px",cursor:"pointer",letterSpacing:2,textShadow:"0 0 6px #0f0"}}>JUGAR DE NUEVO</button>
      </div>
    </div>
  )}
</div>

);
}


