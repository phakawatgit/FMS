const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export type ApiOverview = {
  success: boolean;
  data?: {
    message: string;
    database: "connected" | "disconnected";
    counts: { users: number; dutyShifts: number };
    modules: string[];
  };
  message?: string;
};

export async function getApiOverview(): Promise<ApiOverview> {
  const response = await fetch(`${API_URL}/api/overview`, {
    cache: "no-store",
  });

  const body = (await response.json()) as ApiOverview;
  if (!response.ok) throw new Error(body.message ?? "API request failed");
  return body;
}
