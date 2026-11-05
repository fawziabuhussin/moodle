import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Entilaka",
    short_name: "Entilaka",
    description: "Learning, attendance, stipends, and course communication.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#0284C7",
    lang: "he",
    dir: "rtl",
  };
}
