// Probe: are our XTrace credentials valid? Write one fact, search it back.
// Run: node --env-file=.env src/xtrace-probe.ts
import { MemoryClient } from "@xtraceai/memory";

const client = new MemoryClient({
  apiKey: process.env.XTRACE_API_KEY!,
  orgId: process.env.XTRACE_ORG_ID!,
});

try {
  const job = await client.memories.ingest({
    messages: [
      { role: "user", content: "Probe: Backend committed to map data API at current scope by June 19." },
    ],
    user_id: "meridian",
    conv_id: "probe_conv_1",
  });
  console.log("✅ ingest accepted, job id:", job.id);
  const done = await client.memories.jobs.pollUntilDone(job.id);
  console.log("✅ extraction done, memories created:", done.result?.memories_created);
  process.exit(0);
} catch (err) {
  console.error("❌ XTrace probe failed:");
  console.error(String(err).slice(0, 500));
  process.exit(1);
}
