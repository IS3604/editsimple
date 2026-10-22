/** Client-safe helper: private storage paths are served through the authenticated /api/assets proxy. */
export const assetUrlClient = (path: string | null | undefined) => (path ? `/api/assets?path=${encodeURIComponent(path)}` : null);
