// Probe: can Spectrum Cloud issue Slack tokens for this project?
// Run: node --env-file=.env src/slack-probe.ts
import { Spectrum } from "spectrum-ts";
import { slack } from "spectrum-ts/providers/slack";

try {
  const app = await Spectrum({
    projectId: process.env.PHOTON_PROJECT_ID!,
    projectSecret: process.env.PHOTON_PROJECT_SECRET!,
    providers: [slack.config({})],
  });
  console.log("✅ Slack cloud mode initialized — project credentials accepted.");
  // Give the event stream a moment, then exit; we only care about connectivity.
  setTimeout(async () => {
    await app.stop();
    process.exit(0);
  }, 5000);
  for await (const [space, message] of app.messages) {
    console.log("📨 message received from team/space:", space.id);
  }
} catch (err) {
  console.error("❌ Slack cloud mode failed:");
  console.error(String(err).slice(0, 600));
  process.exit(1);
}
