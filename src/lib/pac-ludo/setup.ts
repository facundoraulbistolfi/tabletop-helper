import { ALL_CHARACTERS, CENTER_PAC_CHARACTER_ID, CHARACTERS_BY_ID, DEFAULT_CHARACTER_IDS } from "./characters";
import type { FacingDirection, PlayerSetupSlot, RuntimePlayer } from "./types";

export const PREVIEW_DIRECTIONS: FacingDirection[] = ["right", "down", "left", "up"];

export function createDefaultSetupSlots(): PlayerSetupSlot[] {
  return DEFAULT_CHARACTER_IDS.map((characterId) => ({
    characterId,
    displayName: CHARACTERS_BY_ID[characterId].name,
    hasCustomName: false,
  }));
}

export function isCharacterTaken(slots: PlayerSetupSlot[], characterId: string, currentIndex: number, activeCount = slots.length): boolean {
  return slots.some((slot, index) => index < activeCount && index !== currentIndex && slot.characterId === characterId);
}

export function updateSetupCharacter(slots: PlayerSetupSlot[], index: number, characterId: string, activeCount = slots.length): PlayerSetupSlot[] {
  if (!CHARACTERS_BY_ID[characterId] || isCharacterTaken(slots, characterId, index, activeCount)) return slots;

  return slots.map((slot, slotIndex) => {
    if (slotIndex !== index) return slot;
    const nextCharacter = CHARACTERS_BY_ID[characterId];
    return {
      ...slot,
      characterId,
      displayName: slot.hasCustomName ? slot.displayName : nextCharacter.name,
    };
  });
}

export function updateSetupName(slots: PlayerSetupSlot[], index: number, rawName: string): PlayerSetupSlot[] {
  return slots.map((slot, slotIndex) => {
    if (slotIndex !== index) return slot;

    const defaultName = CHARACTERS_BY_ID[slot.characterId].name;
    const trimmed = rawName.trim();
    const hasCustomName = trimmed.length > 0 && trimmed !== defaultName;

    return {
      ...slot,
      displayName: hasCustomName ? rawName : defaultName,
      hasCustomName,
    };
  });
}

export function getEffectivePlayerName(slot: PlayerSetupSlot): string {
  const trimmed = slot.displayName.trim();
  return trimmed || CHARACTERS_BY_ID[slot.characterId].name;
}

export function buildRuntimePlayers(slots: PlayerSetupSlot[], playerCount: number): RuntimePlayer[] {
  return slots.slice(0, playerCount).map((slot, seatId) => ({
    ...CHARACTERS_BY_ID[slot.characterId],
    seatId,
    displayName: getEffectivePlayerName(slot),
  }));
}

export function createPreviewDirections(slotCount: number): FacingDirection[] {
  return Array.from({ length: slotCount }, () => "right");
}

export function cyclePreviewDirection(direction: FacingDirection): FacingDirection {
  const index = PREVIEW_DIRECTIONS.indexOf(direction);
  return PREVIEW_DIRECTIONS[(index + 1) % PREVIEW_DIRECTIONS.length];
}

export function updatePreviewDirection(previews: FacingDirection[], index: number): FacingDirection[] {
  return previews.map((direction, previewIndex) => (
    previewIndex === index ? cyclePreviewDirection(direction) : direction
  ));
}

export function resetPreviewDirection(previews: FacingDirection[], index: number): FacingDirection[] {
  return previews.map((direction, previewIndex) => (previewIndex === index ? "right" : direction));
}

export function normalizeActiveSetupSlots(slots: PlayerSetupSlot[], activeCount: number): PlayerSetupSlot[] {
  const used = new Set<string>();

  return slots.map((slot, index) => {
    if (index >= activeCount) return slot;
    if (!used.has(slot.characterId)) {
      used.add(slot.characterId);
      return slot;
    }

    const fallback = ALL_CHARACTERS.find((character) => !used.has(character.id));
    if (!fallback) return slot;
    used.add(fallback.id);

    return {
      ...slot,
      characterId: fallback.id,
      displayName: slot.hasCustomName ? slot.displayName : fallback.name,
    };
  });
}

export function shouldShowCenterCharacter(characterIds: string[]): boolean {
  return !characterIds.includes(CENTER_PAC_CHARACTER_ID);
}
