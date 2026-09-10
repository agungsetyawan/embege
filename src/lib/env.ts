export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Env ${name} belum diisi`);
  return value;
}
