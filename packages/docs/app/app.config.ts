export default defineAppConfig({
  ui: {
    colors: {
      primary: "brand",
      secondary: "brand-secondary",
      neutral: "slate",
    },
    footer: {
      slots: {
        root: "border-t border-default",
        left: "text-sm text-muted",
      },
    },
  },
  seo: {
    siteName: "zod-mongoose",
  },
  header: {
    title: "zod-mongoose",
    to: "/",
    logo: {
      alt: "zod-mongoose logo",
      light: "/zodmongoose.svg",
      dark: "/zodmongoose.svg",
    },
    search: true,
    colorMode: true,
    links: [
      {
        label: "Playground",
        to: "/playground",
      },
      {
        icon: "i-simple-icons-github",
        to: "https://github.com/Harm-Nullix/zod-mongoose",
        target: "_blank",
        "aria-label": "GitHub",
      },
    ],
  },
  footer: {
    credits: `Built with Nuxt UI • © ${new Date().getFullYear()} zod-mongoose`,
    colorMode: false,
    links: [
      {
        icon: "i-simple-icons-github",
        to: "https://github.com/Harm-Nullix/zod-mongoose",
        target: "_blank",
        "aria-label": "GitHub",
      },
    ],
  },
  toc: {
    title: "Table of Contents",
    bottom: {
      title: "Community",
      edit: "https://github.com/Harm-Nullix/zod-mongoose/edit/main/packages/docs/content",
      links: [
        {
          icon: "i-lucide-star",
          label: "Star on GitHub",
          to: "https://github.com/Harm-Nullix/zod-mongoose",
          target: "_blank",
        },
      ],
    },
  },
});
