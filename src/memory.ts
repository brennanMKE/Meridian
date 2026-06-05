// XTrace memory layer — commitments in, contradiction context out.
import { MemoryClient } from "@xtraceai/memory";

const client = new MemoryClient({
  apiKey: process.env.XTRACE_API_KEY!,
  orgId: process.env.XTRACE_ORG_ID!,
});

const USER = "meridian";

export async function writeFact(text: string, convId: string): Promise<void> {
  await client.memories.ingest({
    messages: [{ role: "user", content: text }],
    user_id: USER,
    conv_id: convId,
  });
}

export async function queryImpacts(query: string): Promise<string[]> {
  try {
    const results = await client.memories.search({ query, user_id: USER });
    return (results.data ?? []).map((m: any) => m.text).filter(Boolean).slice(0, 10);
  } catch {
    return [];
  }
}
