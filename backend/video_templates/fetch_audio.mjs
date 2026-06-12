import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const apiKey = process.env.HEYGEN_API_KEY;
const musicQuery =
  process.env.HEYGEN_MUSIC_QUERY ||
  "warm optimistic Indian family finance, gentle acoustic percussion, no vocals";
const soundEffectQuery =
  process.env.HEYGEN_SFX_QUERY ||
  "soft paper receipt whoosh with a subtle cash register chime";

async function curl(url, headers = []) {
  const args = [
    "--fail",
    "--silent",
    "--show-error",
    "--location",
    "--retry",
    "5",
    "--retry-delay",
    "1",
    "--retry-all-errors",
  ];
  for (const header of headers) {
    args.push("--header", header);
  }
  args.push(url);

  const { stdout } = await execFileAsync("curl", args, {
    encoding: "buffer",
    maxBuffer: 100 * 1024 * 1024,
  });
  return stdout;
}

async function searchAudio(query, type) {
  if (!apiKey) {
    throw new Error("HEYGEN_API_KEY is required for catalog audio");
  }

  const url = new URL("https://api.heygen.com/v3/audio/sounds");
  url.searchParams.set("query", query);
  url.searchParams.set("type", type);
  url.searchParams.set("limit", "5");
  url.searchParams.set("min_score", "0.5");

  const payload = JSON.parse(
    (
      await curl(url.toString(), [
        "accept: application/json",
        `x-api-key: ${apiKey}`,
      ])
    ).toString("utf8"),
  );
  const match = payload.data?.[0];
  if (!match?.audio_url) {
    throw new Error(`HeyGen returned no ${type} result for "${query}"`);
  }
  return match;
}

let music;
let soundEffect;

try {
  const selection = JSON.parse(await readFile("audio-selection.json", "utf8"));
  music = selection.music;
  soundEffect = selection.sound_effect;
} catch {
  music = await searchAudio(musicQuery, "music");
  soundEffect = await searchAudio(soundEffectQuery, "sound_effects");
}

await writeFile("music-source", await curl(music.audio_url));
await writeFile("transition-source", await curl(soundEffect.audio_url));

await writeFile(
  "audio-metadata.json",
  JSON.stringify(
    {
      provider: "heygen",
      music: {
        id: music.id,
        name: music.name,
        description: music.description,
      },
      sound_effect: {
        id: soundEffect.id,
        name: soundEffect.name,
        description: soundEffect.description,
      },
    },
    null,
    2,
  ),
);
