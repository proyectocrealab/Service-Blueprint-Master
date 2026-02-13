import { BlueprintColumn, SavedBlueprint } from "../types";

const STORAGE_KEY = 'service_blueprint_saves';

export const getSavedBlueprints = (): SavedBlueprint[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load saves", e);
    return [];
  }
};

export const saveBlueprint = (name: string, scenarioId: string, blueprint: BlueprintColumn[], existingId?: string): SavedBlueprint => {
  const saves = getSavedBlueprints();
  let newSave: SavedBlueprint;

  if (existingId) {
    // Update existing save
    const existingIndex = saves.findIndex(s => s.id === existingId);
    if (existingIndex >= 0) {
      newSave = {
        ...saves[existingIndex],
        name, // Allow renaming
        blueprint,
        lastModified: Date.now()
      };
      saves[existingIndex] = newSave;
    } else {
      // Fallback if ID not found
      newSave = {
        id: Date.now().toString(),
        name,
        scenarioId,
        blueprint,
        lastModified: Date.now()
      };
      saves.unshift(newSave);
    }
  } else {
    // Create new save
    newSave = {
      id: Date.now().toString(),
      name,
      scenarioId,
      blueprint,
      lastModified: Date.now()
    };
    saves.unshift(newSave);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  return newSave;
};

export const deleteBlueprint = (id: string) => {
  const saves = getSavedBlueprints().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
};