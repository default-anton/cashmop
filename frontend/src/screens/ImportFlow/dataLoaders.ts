import type { ImportMapping, SavedMapping } from "./components/ColumnMapperTypes";

export const fetchSavedMappings = async (): Promise<SavedMapping[]> => {
  const dbMappings: any[] = await (window as any).go.main.App.GetColumnMappings();
  const loaded: SavedMapping[] = [];
  for (const m of dbMappings) {
    try {
      const parsed = JSON.parse(m.mapping_json);
      if (!parsed?.csv?.amountMapping) continue;
      const mappingWithoutOwner = { ...(parsed as ImportMapping) };
      delete mappingWithoutOwner.owner;
      loaded.push({
        id: m.id,
        name: m.name,
        mapping: mappingWithoutOwner,
      });
    } catch (e) {
      console.warn(`Skipping invalid saved mapping: ${m?.name ?? m?.id ?? "unknown"}`, e);
    }
  }
  return loaded;
};

export const fetchAccountsOwners = async () => {
  const [accounts, owners]: [string[], string[]] = await Promise.all([
    (window as any).go.main.App.GetAccounts(),
    (window as any).go.main.App.GetOwners(),
  ]);
  return { accounts: accounts || [], owners: owners || [] };
};
