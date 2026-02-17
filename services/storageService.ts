
import { BlueprintColumn, SavedBlueprint, Scenario } from "../types";

const STORAGE_KEY = 'service_blueprint_saves_v2';

const calculateCompletion = (blueprint: BlueprintColumn[]): number => {
  if (blueprint.length === 0) return 0;
  const layers: (keyof BlueprintColumn)[] = ['physical', 'customer', 'frontstage', 'backstage', 'support'];
  let totalCells = blueprint.length * layers.length;
  let filledCells = 0;

  blueprint.forEach(col => {
    layers.forEach(layer => {
      if (typeof col[layer] === 'string' && (col[layer] as string).trim() !== '') {
        filledCells++;
      }
    });
  });

  return Math.round((filledCells / totalCells) * 100);
};

export const getSavedBlueprints = (): SavedBlueprint[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load saves", e);
    return [];
  }
};

export const saveBlueprint = (
  name: string, 
  studentName: string,
  scenario: Scenario, 
  blueprint: BlueprintColumn[], 
  existingId?: string,
  isLibrary?: boolean,
  score?: number
): SavedBlueprint => {
  let saves = getSavedBlueprints();
  let newSave: SavedBlueprint;

  const completionRate = calculateCompletion(blueprint);
  const status = completionRate === 100 ? 'completed' : 'draft';

  if (existingId) {
    const existingIndex = saves.findIndex(s => s.id === existingId);
    if (existingIndex >= 0) {
      newSave = {
        ...saves[existingIndex],
        name,
        studentName,
        scenario,
        blueprint,
        lastModified: Date.now(),
        isLibrary: isLibrary !== undefined ? isLibrary : saves[existingIndex].isLibrary,
        score: score !== undefined ? score : saves[existingIndex].score,
        completionRate,
        status
      };
      saves[existingIndex] = newSave;
    } else {
      newSave = {
        id: Date.now().toString(),
        name,
        studentName,
        scenario,
        blueprint,
        lastModified: Date.now(),
        isLibrary: !!isLibrary,
        score,
        completionRate,
        status
      };
      saves.unshift(newSave);
    }
  } else {
    newSave = {
      id: Date.now().toString(),
      name,
      studentName,
      scenario,
      blueprint,
      lastModified: Date.now(),
      isLibrary: !!isLibrary,
      score,
      completionRate,
      status
    };
    saves.unshift(newSave);
  }
  
  saves.sort((a, b) => b.lastModified - a.lastModified);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  return newSave;
};

export const deleteBlueprint = (id: string) => {
  const saves = getSavedBlueprints().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
};

export const exportAllData = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    alert("No data to export.");
    return;
  }
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `blueprint_toolkit_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importDataFromFile = (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedSaves = JSON.parse(content);
        if (Array.isArray(importedSaves)) {
          const existing = getSavedBlueprints();
          const existingIds = new Set(existing.map(s => s.id));
          const newSaves = [...existing];
          
          importedSaves.forEach(save => {
            if (!existingIds.has(save.id)) {
              newSaves.push(save);
            }
          });
          
          newSaves.sort((a, b) => b.lastModified - a.lastModified);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newSaves));
          resolve();
        } else {
          reject(new Error("Invalid backup format."));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
};
