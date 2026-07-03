/// <reference path="./.sst/platform/config.d.ts" />

/**
 * Deploys the TravelTicker scraper (../scraper) as a scheduled Fargate task.
 * A container is used instead of a plain Lambda because crawl4ai bundles a
 * real Chromium browser, which doesn't fit in Lambda's zip size limits.
 *
 * This only defines infrastructure -- it does not deploy anything by itself.
 * See ../scraper/README.md for `sst secret set` / `sst deploy` steps.
 */
export default $config({
  app(input) {
    return {
      name: "travel-ticker-scraper",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    const supabaseUrl = new sst.Secret("SupabaseUrl");
    const supabaseServiceRoleKey = new sst.Secret("SupabaseServiceRoleKey");

    const vpc = new sst.aws.Vpc("ScraperVpc");
    const cluster = new sst.aws.Cluster("ScraperCluster", { vpc });

    const scraperTask = new sst.aws.Task("ScraperTask", {
      cluster,
      image: {
        context: "../scraper",
        dockerfile: "Dockerfile",
      },
      link: [supabaseUrl, supabaseServiceRoleKey],
      environment: {
        SUPABASE_URL: supabaseUrl.value,
        SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey.value,
      },
    });

    new sst.aws.Cron("ScraperSchedule", {
      task: scraperTask,
      schedule: "rate(6 hours)",
    });

    return {
      cluster: cluster.id,
    };
  },
});
