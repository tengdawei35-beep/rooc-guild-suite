import { Ro3MemoryDataStore } from "./engine/ro3-damage-engine.mjs";
import { loadRo3GameData } from "./data/ro3-game-data";

/**
 * Loads the same full exported game tables used by the legacy simulator and
 * constructs the calculation engine's in-memory data adapter.
 */
export async function createRo3CombatDataStore(): Promise<Ro3MemoryDataStore> {
  const exported = await loadRo3GameData();
  return new Ro3MemoryDataStore(exported.tables);
}
