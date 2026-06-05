import { Spectrum } from "spectrum-ts";
import { slack } from "spectrum-ts/providers/slack";

const app = await Spectrum({
  projectId: process.env.PHOTON_PROJECT_ID!,
  projectSecret: process.env.PHOTON_PROJECT_SECRET!,
  providers: [slack.config({})],
});

console.log("Meridian agent running — waiting for Slack messages…");

for await (const [space, message] of app.messages) {
  await space.responding(async () => {
    await message.reply("Hello from Meridian.");
  });
}
