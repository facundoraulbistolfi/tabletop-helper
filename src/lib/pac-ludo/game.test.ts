import { describe, expect, it } from "vitest";

import { buildMoveSegments, getTokenFacing, PATH } from "./board";
import { ALL_CHARACTERS, CHARACTER_SETS, DEFAULT_CHARACTER_IDS } from "./characters";
import { allInBase, createTokens, executeMove, getCombatRouletteConfig, getRouletteConfig, resolveCombat, resolveRouletteAngle, resolveRouletteSelection } from "./game";
import {
  buildRuntimePlayers,
  createDefaultSetupSlots,
  createPreviewDirections,
  normalizeActiveSetupSlots,
  resetPreviewDirection,
  shouldShowCenterCharacter,
  updatePreviewDirection,
  updateSetupCharacter,
  updateSetupName,
} from "./setup";

describe("pac-ludo setup", () => {
  it("keeps the roster limited to ghosts plus Pac-Man and Ms. Pac-Man", () => {
    expect(CHARACTER_SETS.map((set) => set.id)).toEqual(["ghosts", "pac-family"]);
    expect(ALL_CHARACTERS.map((character) => character.name)).toEqual([
      "Blinky",
      "Inky",
      "Clyde",
      "Pinky",
      "Pac-Man",
      "Ms. Pac-Man",
    ]);
  });

  it("starts with the ghost roster and matching default names", () => {
    const slots = createDefaultSetupSlots();

    expect(slots.map((slot) => slot.characterId)).toEqual(DEFAULT_CHARACTER_IDS);
    expect(slots.map((slot) => slot.displayName)).toEqual(["Blinky", "Inky", "Clyde", "Pinky"]);
  });

  it("updates the display name when the slot still uses the default character name", () => {
    const nextSlots = updateSetupCharacter(createDefaultSetupSlots(), 0, "pac-family-pac-man");
    const runtimePlayers = buildRuntimePlayers(nextSlots, 2);

    expect(nextSlots[0]?.displayName).toBe("Pac-Man");
    expect(runtimePlayers[0]?.displayName).toBe("Pac-Man");
  });

  it("keeps a custom name after switching characters", () => {
    const renamed = updateSetupName(createDefaultSetupSlots(), 0, "Facu");
    const switched = updateSetupCharacter(renamed, 0, "pac-family-ms-pac-man");

    expect(switched[0]?.displayName).toBe("Facu");
  });

  it("only blocks duplicate picks among active players and normalizes when new seats appear", () => {
    const slots = createDefaultSetupSlots();
    const twoPlayerSetup = updateSetupCharacter(slots, 0, "ghost-clyde", 2);
    const normalizedForThree = normalizeActiveSetupSlots(twoPlayerSetup, 3);

    expect(twoPlayerSetup[0]?.characterId).toBe("ghost-clyde");
    expect(normalizedForThree[0]?.characterId).toBe("ghost-clyde");
    expect(normalizedForThree[1]?.characterId).toBe("ghost-inky");
    expect(normalizedForThree[2]?.characterId).not.toBe("ghost-clyde");
  });

  it("hides the center pac character only when Pac-Man is an active pick", () => {
    expect(shouldShowCenterCharacter(["ghost-blinky", "ghost-inky"])).toBe(true);
    expect(shouldShowCenterCharacter(["ghost-blinky", "pac-family-pac-man"])).toBe(false);
  });

  it("cycles setup preview directions in the expected order", () => {
    const previews = createPreviewDirections(4);
    const one = updatePreviewDirection(previews, 0);
    const two = updatePreviewDirection(one, 0);
    const three = updatePreviewDirection(two, 0);
    const four = updatePreviewDirection(three, 0);

    expect(one[0]).toBe("down");
    expect(two[0]).toBe("left");
    expect(three[0]).toBe("up");
    expect(four[0]).toBe("right");
  });

  it("resets the preview direction to right after changing character", () => {
    const previews = ["left", "down", "up", "right"] as const;
    const reset = resetPreviewDirection([...previews], 0);

    expect(reset[0]).toBe("right");
    expect(reset[1]).toBe("down");
  });

  it("rotating the preview does not change slot identity or display name", () => {
    const slots = updateSetupName(createDefaultSetupSlots(), 0, "Facu");
    const previews = updatePreviewDirection(createPreviewDirections(4), 0);

    expect(slots[0]?.characterId).toBe("ghost-blinky");
    expect(slots[0]?.displayName).toBe("Facu");
    expect(previews[0]).toBe("down");
  });
});

describe("pac-ludo movement and facing", () => {
  it("keeps base tokens facing down", () => {
    const tokens = createTokens(2);

    expect(tokens[0][0]?.facing).toBe("down");
    expect(getTokenFacing(tokens[0][0], 0)).toBe("down");
  });

  it("aims path tokens toward the next square on straight segments", () => {
    const tokens = createTokens(2);
    tokens[0][0] = {
      ...tokens[0][0],
      state: "path",
      pathIdx: 12,
      homeIdx: -1,
    };

    expect(getTokenFacing(tokens[0][0], 0)).toBe("right");
  });

  it("builds step-by-step movement into home and resets to down when finishing", () => {
    const tokens = createTokens(2);
    tokens[0][0] = {
      ...tokens[0][0],
      state: "home",
      pathIdx: -1,
      homeIdx: 4,
      facing: "up",
    };

    const segments = buildMoveSegments(tokens[0][0], 0, 1);
    const result = executeMove(tokens, 0, tokens[0][0].id, 1, 2);

    expect(segments).toEqual([{ row: 7, col: 6, facing: "right" }]);
    expect(result.tokens[0][0]?.state).toBe("finished");
    expect(result.tokens[0][0]?.facing).toBe("down");
  });

  it("captures enemies on non-safe path squares", () => {
    const tokens = createTokens(2);
    tokens[0][0] = { ...tokens[0][0], state: "path", pathIdx: 1, homeIdx: -1 };
    tokens[1][0] = { ...tokens[1][0], state: "path", pathIdx: 2, homeIdx: -1 };

    const result = executeMove(tokens, 0, tokens[0][0].id, 1, 2);

    expect(result.captured).toBe(true);
    expect(result.tokens[0][0]?.pathIdx).toBe(2);
    expect(result.tokens[1][0]?.state).toBe("base");
    expect(result.tokens[1][0]?.pathIdx).toBe(-1);
    expect(result.tokens[1][0]?.facing).toBe("down");
  });

  it("can leave rivals contested on a square when auto-capture is disabled", () => {
    const tokens = createTokens(2);
    tokens[0][0] = { ...tokens[0][0], state: "path", pathIdx: 1, homeIdx: -1 };
    tokens[1][0] = { ...tokens[1][0], state: "path", pathIdx: 2, homeIdx: -1 };

    const result = executeMove(tokens, 0, tokens[0][0].id, 1, 2, { autoCapture: false });

    expect(result.captured).toBe(false);
    expect(result.contestedTokenIds).toEqual([tokens[1][0].id]);
    expect(result.tokens[0][0]?.pathIdx).toBe(2);
    expect(result.tokens[1][0]?.pathIdx).toBe(2);
  });
});

describe("pac-ludo roulette helpers", () => {
  it("treats home tokens as active pieces when checking all-in-base", () => {
    const tokens = createTokens(2);
    tokens[0][0] = { ...tokens[0][0], state: "home", pathIdx: -1, homeIdx: 0 };

    expect(allInBase(tokens[0])).toBe(false);
  });

  it("uses the softer hardcore weights and ghost-entry odds", () => {
    const hardcore = getRouletteConfig("hardcore", false);
    const baseOnly = getRouletteConfig("hardcore", true);
    const combat = getCombatRouletteConfig("hardcore");

    expect(hardcore.map((section) => section.weight)).toEqual([1, 2, 3, 5, 8, 12]);
    expect(baseOnly).toEqual([
      { value: 1, label: "👻", weight: 15, color: "#2B6B59" },
      { value: 0, label: "", weight: 85, color: "#5B2431" },
    ]);
    expect(combat).toEqual([
      { value: 1, label: "🔪", weight: 15, color: "#2B6B59" },
      { value: 0, label: "", weight: 85, color: "#5B2431" },
    ]);
  });

  it("resolves angles against the weighted slices consistently", () => {
    const sections = getRouletteConfig("hardcore", false);

    expect(resolveRouletteAngle(0, sections)).toBe(6);
    expect(resolveRouletteAngle(160, sections)).toBe(2);
  });

  it("snaps the wheel so the resolved slice ends under the pointer", () => {
    const sections = getRouletteConfig("hardcore", false);
    const selection = resolveRouletteSelection(160, sections);

    expect(selection.value).toBe(2);
    expect(resolveRouletteAngle(selection.snappedAngle, sections)).toBe(2);
  });

  it("resolves combat captures only after a successful attack roulette", () => {
    const tokens = createTokens(2);
    tokens[0][0] = { ...tokens[0][0], state: "path", pathIdx: 2, homeIdx: -1 };
    tokens[1][0] = { ...tokens[1][0], state: "path", pathIdx: 2, homeIdx: -1 };

    const resolved = resolveCombat(tokens, [tokens[1][0].id]);

    expect(resolved[0][0]?.pathIdx).toBe(2);
    expect(resolved[1][0]?.state).toBe("base");
    expect(resolved[1][0]?.pathIdx).toBe(-1);
  });
});

describe("pac-ludo board fixtures", () => {
  it("keeps the route length stable for menu animation and movement math", () => {
    expect(PATH).toHaveLength(52);
  });

  it("keeps all characters with four directional frames", () => {
    expect(ALL_CHARACTERS.every((character) => (
      character.frames.up.rows.length > 0
      && character.frames.right.rows.length > 0
      && character.frames.down.rows.length > 0
      && character.frames.left.rows.length > 0
    ))).toBe(true);
  });
});
