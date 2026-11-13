import type { MetadataRoute } from "next";

/**
 * What a phone or a computer needs to install the app (« Sur l'écran
 * d'accueil » on an iPhone, « Ajouter au Dock » in Safari on a Mac, « Installer »
 * in Chrome): its name, its icons, and that it opens on its own, without the
 * browser's bars. The icons are the pixel tomato of the logo on warm paper.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Team Tomate HQ",
    short_name: "Tomate HQ",
    description: "Le QG de l'équipe Prospero : projets, tâches et meeting hebdomadaire.",
    lang: "fr-CA",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbf6ee",
    theme_color: "#fbf6ee",
    icons: [
      { src: "/icons/app-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/app-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
