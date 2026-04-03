import blinkyDown from "../../assets/pac-ludo/ghosts/blinky-down.png";
import blinkyLeft from "../../assets/pac-ludo/ghosts/blinky-left.png";
import blinkyRight from "../../assets/pac-ludo/ghosts/blinky-right.png";
import blinkyUp from "../../assets/pac-ludo/ghosts/blinky-up.png";
import clydeDown from "../../assets/pac-ludo/ghosts/clyde-down.png";
import clydeLeft from "../../assets/pac-ludo/ghosts/clyde-left.png";
import clydeRight from "../../assets/pac-ludo/ghosts/clyde-right.png";
import clydeUp from "../../assets/pac-ludo/ghosts/clyde-up.png";
import inkyDown from "../../assets/pac-ludo/ghosts/inky-down.png";
import inkyLeft from "../../assets/pac-ludo/ghosts/inky-left.png";
import inkyRight from "../../assets/pac-ludo/ghosts/inky-right.png";
import inkyUp from "../../assets/pac-ludo/ghosts/inky-up.png";
import pinkyDown from "../../assets/pac-ludo/ghosts/pinky-down.png";
import pinkyLeft from "../../assets/pac-ludo/ghosts/pinky-left.png";
import pinkyRight from "../../assets/pac-ludo/ghosts/pinky-right.png";
import pinkyUp from "../../assets/pac-ludo/ghosts/pinky-up.png";
import msPacManDown from "../../assets/pac-ludo/pac-family/ms-pac-man-down.png";
import msPacManLeft from "../../assets/pac-ludo/pac-family/ms-pac-man-left.png";
import msPacManRight from "../../assets/pac-ludo/pac-family/ms-pac-man-right.png";
import msPacManUp from "../../assets/pac-ludo/pac-family/ms-pac-man-up.png";
import pacManDown from "../../assets/pac-ludo/pac-family/pac-man-down.png";
import pacManLeft from "../../assets/pac-ludo/pac-family/pac-man-left.png";
import pacManRight from "../../assets/pac-ludo/pac-family/pac-man-right.png";
import pacManUp from "../../assets/pac-ludo/pac-family/pac-man-up.png";

import type { CharacterDefinition, CharacterSetDefinition, PixelFrame, RasterFrameSource } from "./types";

const OUTLINE = "#141321";
const WHITE = "#f6fbff";
const GOLD = "#ffd84c";

function alpha(hex: string, suffix: string): string {
  return `${hex}${suffix}`;
}

function darken(hex: string, factor: number): string {
  const normalized = hex.replace("#", "");
  const red = Math.max(0, Math.min(255, Math.round(parseInt(normalized.slice(0, 2), 16) * factor)));
  const green = Math.max(0, Math.min(255, Math.round(parseInt(normalized.slice(2, 4), 16) * factor)));
  const blue = Math.max(0, Math.min(255, Math.round(parseInt(normalized.slice(4, 6), 16) * factor)));
  return `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
}

function lighten(hex: string, factor: number): string {
  const normalized = hex.replace("#", "");
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const nextRed = Math.max(0, Math.min(255, Math.round(red + (255 - red) * (factor - 1))));
  const nextGreen = Math.max(0, Math.min(255, Math.round(green + (255 - green) * (factor - 1))));
  const nextBlue = Math.max(0, Math.min(255, Math.round(blue + (255 - blue) * (factor - 1))));
  return `#${nextRed.toString(16).padStart(2, "0")}${nextGreen.toString(16).padStart(2, "0")}${nextBlue.toString(16).padStart(2, "0")}`;
}

function frame(rows: string[], palette: Record<string, string>): PixelFrame {
  return { rows, palette };
}

function mirror(rows: string[]): string[] {
  return rows.map((row) => row.split("").reverse().join(""));
}

function buildFrames(rows: {
  up: string[];
  right: string[];
  down: string[];
  left?: string[];
}, palette: Record<string, string>) {
  return {
    up: frame(rows.up, palette),
    right: frame(rows.right, palette),
    down: frame(rows.down, palette),
    left: frame(rows.left ?? mirror(rows.right), palette),
  };
}

function buildCharacter(
  id: string,
  setId: string,
  name: string,
  color: string,
  frames: CharacterDefinition["frames"],
  rasterFrames?: RasterFrameSource,
): CharacterDefinition {
  return {
    id,
    setId,
    name,
    color,
    glow: alpha(color, "88"),
    home: darken(color, 0.22),
    frames,
    rasterFrames,
    previewFrame: "right",
  };
}

function makeGhostRasterFrames(frameSrcByDirection: RasterFrameSource["frameSrcByDirection"]): RasterFrameSource {
  return {
    frameSrcByDirection,
  };
}

function makeGhostFrames(color: string) {
  const highlight = lighten(color, 1.28);
  const shadow = darken(color, 0.72);

  return buildFrames(
    {
      up: [
        "...OOOO...",
        "..OBBBBO..",
        ".OBHWWHBO.",
        "OBBWPWPBBO",
        "OBBW..WBBO",
        "OBBBBBBBBO",
        "OBBBBBBBBO",
        "OBBOBBOBBO",
        "OBO....OBO",
        ".O......O.",
      ],
      right: [
        "...OOOO...",
        "..OBBBBO..",
        ".OBHWWHBO.",
        "OBBWWPPBBO",
        "OBBW..WBBO",
        "OBBBBBBBBO",
        "OBBBBBBSBO",
        "OBBOBBOBBO",
        "OBO....OBO",
        ".O......O.",
      ],
      down: [
        "...OOOO...",
        "..OBBBBO..",
        ".OBHWWHBO.",
        "OBBW..WBBO",
        "OBBWPWPBBO",
        "OBBBBBBBBO",
        "OBBBBBBSBO",
        "OBBOBBOBBO",
        "OBO....OBO",
        ".O......O.",
      ],
      left: [
        "...OOOO...",
        "..OBBBBO..",
        ".OBHWWHBO.",
        "OBBPPWWBBO",
        "OBBW..WBBO",
        "OBBBBBBBBO",
        "OBSBBBBBBO",
        "OBBOBBOBBO",
        "OBO....OBO",
        ".O......O.",
      ],
    },
    {
      O: OUTLINE,
      B: color,
      H: highlight,
      S: shadow,
      W: WHITE,
      P: "#111827",
    },
  );
}

function makeBlinkyReferenceFrames() {
  const color = "#ff3b3f";
  const highlight = "#ff8a7d";
  const mid = "#ff5b55";
  const shadow = "#d61f33";
  const iris = "#1d62ff";
  const pupil = "#1137b9";

  return buildFrames(
    {
      up: [
        "....OOOO....",
        "...OBBBBO...",
        "..OBHMMHBO..",
        ".OBMMMMMMBO.",
        ".OBMMMMMMBO.",
        "OBMMMMMMMMBO",
        "OBMMMMMMMMBO",
        "OBMMMMMMMMBO",
        "OBMMMMMMMMBO",
        "OBBMMBBMMBBO",
        ".OBBBOOBBBO.",
        "..O......O..",
      ],
      right: [
        "....OOOO....",
        "...OBBBBO...",
        "..OBHMMHBO..",
        ".OBWWWMMMBO.",
        ".OWWWIWWMMO.",
        "OBWWWIWWMMBO",
        "OBMWWWWMMMBO",
        "OBMMMMMMMMBO",
        "OBMMMMMMMMBO",
        "OBBMMBBMMBBO",
        ".OBBBOOBBBO.",
        "..O......O..",
      ],
      down: [
        "....OOOO....",
        "...OBBBBO...",
        "..OBHMMHBO..",
        ".OBWWWWWWBO.",
        ".OWWWIWIWWO.",
        "OBWWWIWIWWBO",
        "OBMMMWWWMMBO",
        "OBMMMMMMMMBO",
        "OBMMMMMMMMBO",
        "OBBMMBBMMBBO",
        ".OBBBOOBBBO.",
        "..O......O..",
      ],
      left: [
        "....OOOO....",
        "...OBBBBO...",
        "..OBHMMHBO..",
        ".OBMMMWWWBO.",
        ".OMMWWIWWWO.",
        "OBMMWWIWWWBO",
        "OBMMMWWWWMBO",
        "OBMMMMMMMMBO",
        "OBMMMMMMMMBO",
        "OBBMMBBMMBBO",
        ".OBBBOOBBBO.",
        "..O......O..",
      ],
    },
    {
      O: OUTLINE,
      B: color,
      H: highlight,
      M: mid,
      W: WHITE,
      I: iris,
      P: pupil,
      S: shadow,
    },
  );
}

function makePacFrames(color: string, eye: string, accent = GOLD) {
  const highlight = lighten(color, 1.16);

  return buildFrames(
    {
      up: [
        "...YYYY...",
        "..YHHHHY..",
        ".YHHHHHHY.",
        "YHHHEEHHHY",
        "YHHH..HHHY",
        ".YHHHHHHY.",
        "..YHBBHY..",
        "...YHHY...",
        "....YY....",
        "..........",
      ],
      right: [
        "...YYYY...",
        "..YHHHHY..",
        ".YHHHH....",
        "YHHH......",
        "YHPE......",
        "YHHH......",
        ".YHHHH....",
        "..YHBBHY..",
        "...YYYY...",
        "..........",
      ],
      down: [
        "...YYYY...",
        "..YHBBHY..",
        ".YHHHHHHY.",
        "YHHH..HHHY",
        "YHHHEEHHHY",
        ".YHHHHHHY.",
        "..YHHHHY..",
        "...YYYY...",
        "..........",
        "..........",
      ],
      left: [
        "...YYYY...",
        "..YHHHHY..",
        "....HHHHY.",
        "......HHHY",
        "......EPHY",
        "......HHHY",
        "....HHHHY.",
        "..YHBBHY..",
        "...YYYY...",
        "..........",
      ],
    },
    {
      Y: color,
      H: highlight,
      E: eye,
      P: OUTLINE,
      B: accent,
    },
  );
}

function makeMsPacFrames(color: string, eye: string, bow: string) {
  const highlight = lighten(color, 1.16);
  const bowLight = lighten(bow, 1.18);

  return buildFrames(
    {
      up: [
        "..BBBB....",
        ".BBBBBB...",
        "..YHHHHY..",
        ".YHHHHHHY.",
        "YHHHEEHHHY",
        "YHHH..HHHY",
        ".YHHHHHHY.",
        "..YHBBHY..",
        "...YYYY...",
        "..........",
      ],
      right: [
        "..BB......",
        ".BBBB.....",
        "..YHHHHY..",
        ".YHHHH....",
        "YHHH......",
        "YHPE......",
        ".YHHHH....",
        "..YHBBHY..",
        "...YYYY...",
        "..........",
      ],
      down: [
        "..BBBB....",
        ".BBBBBB...",
        "..YHBBHY..",
        ".YHHHHHHY.",
        "YHHH..HHHY",
        "YHHHEEHHHY",
        ".YHHHHHHY.",
        "..YHHHHY..",
        "...YYYY...",
        "..........",
      ],
      left: [
        "......BB..",
        ".....BBBB.",
        "..YHHHHY..",
        "....HHHHY.",
        "......HHHY",
        "......EPHY",
        "....HHHHY.",
        "..YHBBHY..",
        "...YYYY...",
        "..........",
      ],
    },
    {
      Y: color,
      H: highlight,
      E: eye,
      P: OUTLINE,
      B: bowLight,
    },
  );
}

const ghosts: CharacterDefinition[] = [
  buildCharacter(
    "ghost-blinky",
    "ghosts",
    "Blinky",
    "#ff4c4c",
    makeBlinkyReferenceFrames(),
    makeGhostRasterFrames({
      up: blinkyUp,
      right: blinkyRight,
      down: blinkyDown,
      left: blinkyLeft,
    }),
  ),
  buildCharacter(
    "ghost-inky",
    "ghosts",
    "Inky",
    "#4ef8ff",
    makeGhostFrames("#4ef8ff"),
    makeGhostRasterFrames({
      up: inkyUp,
      right: inkyRight,
      down: inkyDown,
      left: inkyLeft,
    }),
  ),
  buildCharacter(
    "ghost-clyde",
    "ghosts",
    "Clyde",
    "#ffae45",
    makeGhostFrames("#ffae45"),
    makeGhostRasterFrames({
      up: clydeUp,
      right: clydeRight,
      down: clydeDown,
      left: clydeLeft,
    }),
  ),
  buildCharacter(
    "ghost-pinky",
    "ghosts",
    "Pinky",
    "#ff9be8",
    makeGhostFrames("#ff9be8"),
    makeGhostRasterFrames({
      up: pinkyUp,
      right: pinkyRight,
      down: pinkyDown,
      left: pinkyLeft,
    }),
  ),
];

const pacFamily: CharacterDefinition[] = [
  buildCharacter(
    "pac-family-pac-man",
    "pac-family",
    "Pac-Man",
    "#ffe14d",
    makePacFrames("#ffe14d", "#111111"),
    makeGhostRasterFrames({
      up: pacManUp,
      right: pacManRight,
      down: pacManDown,
      left: pacManLeft,
    }),
  ),
  buildCharacter(
    "pac-family-ms-pac-man",
    "pac-family",
    "Ms. Pac-Man",
    "#ff8ccf",
    makeMsPacFrames("#ffe14d", "#111111", "#ff8ccf"),
    makeGhostRasterFrames({
      up: msPacManUp,
      right: msPacManRight,
      down: msPacManDown,
      left: msPacManLeft,
    }),
  ),
];

export const CHARACTER_SETS: CharacterSetDefinition[] = [
  { id: "ghosts", name: "Ghosts", description: "Los clásicos del Pac-Man, default del juego.", characters: ghosts },
  { id: "pac-family", name: "Pac-Family", description: "La familia Pac con colores propios por personaje.", characters: pacFamily },
];

export const ALL_CHARACTERS = CHARACTER_SETS.flatMap((set) => set.characters);

export const CHARACTERS_BY_ID = Object.fromEntries(
  ALL_CHARACTERS.map((character) => [character.id, character]),
) as Record<string, CharacterDefinition>;

export const DEFAULT_CHARACTER_IDS = ghosts.map((character) => character.id);

export const CENTER_PAC_CHARACTER_ID = "pac-family-pac-man";
