export const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
export const partId = (code: string) => code.trim().toUpperCase().replace(/[\/\s#?\[\]]+/g, '_')
