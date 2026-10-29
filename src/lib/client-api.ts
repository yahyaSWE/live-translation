export class ClientApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(25_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const response = await fetch(url, { ...options, cache: "no-store", signal, headers: { "Content-Type": "application/json", ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new ClientApiError(data.error || "Anropet misslyckades. Försök igen.", response.status);
  return data as T;
}

export function errorMessage(error: unknown) {
  if (error instanceof ClientApiError) return error.message;
  if (error instanceof Error && error.name === "NotAllowedError") return "Mikrofonen är blockerad. Tillåt mikrofonen i webbläsaren och försök igen.";
  return "Anslutningen misslyckades. Kontrollera ditt nätverk och försök igen.";
}
