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
    siteName: "mongoose-zod",
  },
  header: {
    title: "mongoose-zod",
    to: "/",
    logo: {
      alt: "mongoose-zod logo",
      light: "/zodmongoose.svg",
      dark: "/zodmongoose.svg",
    },
    search: true,
    colorMode: true,
    links: [
      {
        icon: "i-simple-icons-github",
        to: "https://github.com/harmzeinstra/mongoose-zod",
        target: "_blank",
        "aria-label": "GitHub",
      },
    ],
  },
  footer: {
    credits: `Built with Nuxt UI • © ${new Date().getFullYear()} mongoose-zod`,
    colorMode: false,
    links: [
      {
        icon: "i-simple-icons-github",
        to: "https://github.com/harmzeinstra/mongoose-zod",
        target: "_blank",
        "aria-label": "GitHub",
      },
    ],
  },
  toc: {
    title: "Table of Contents",
    bottom: {
      title: "Community",
      edit: "https://github.com/harmzeinstra/mongoose-zod/edit/main/packages/docs/content",
      links: [
        {
          icon: "i-lucide-star",
          label: "Star on GitHub",
          to: "https://github.com/harmzeinstra/mongoose-zod",
          target: "_blank",
        },
      ],
    },
  },
});
