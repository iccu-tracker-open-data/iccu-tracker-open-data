import { resolveGoogleSheetCsvUrl } from "./lib/incidents-data.mjs";

const publicRuntimeConfig =
  process.env.NODE_ENV === "production"
    ? {}
    : {
        googleSheetCsvUrl: resolveGoogleSheetCsvUrl({
          explicitCsvUrl: process.env.GOOGLE_SHEET_CSV_URL,
          sheetUrl: process.env.GOOGLE_SHEET_URL,
          gid: process.env.GOOGLE_SHEET_GID,
        }),
      };

export default defineNuxtConfig({
  compatibilityDate: "2026-03-27",
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || "/",
    head: {
      title: "ICCU Incident Tracker — E-GMP Electric Vehicles",
      meta: [
        {
          name: "description",
          content:
            "Community-driven analytics for reported E-GMP ICCU-related incidents. Explore reported patterns by model, mileage, and build date.",
        },
      ],
    },
  },
  runtimeConfig: {
    public: {
      ...publicRuntimeConfig,
      githubRepoUrl: process.env.GH_REPO_URL || "https://github.com/your-org/your-repo",
      githubStarsFallback: process.env.GH_STARS_FALLBACK || "0",
      siteUrl: process.env.SITE_URL || "",
      socialImageUrl: process.env.SOCIAL_IMAGE_URL || "",
      googleFormUrl: process.env.GOOGLE_FORM_URL || "",
    },
  },
  nitro: {
    prerender: {
      routes: ["/"],
    },
  },
});
