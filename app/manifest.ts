import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const startUrl = process.env.GITHUB_ACTIONS === "true" ? "/jia-muscle-coach-workbench/" : "/";
  return {
    name: "增肌教练工作台",
    short_name: "增肌教练",
    description: "训练、恢复与渐进记录工作台",
    start_url: startUrl,
    display: "standalone",
    background_color: "#f4f7f6",
    theme_color: "#17324d",
  };
}

