export interface ProjectTemplate {
  id: string;
  nameKey: string;
  descKey: string;
  icon: string;
  tags: { zh: string[]; en: string[] };
  description: { zh: string; en: string };
  validationItems: { zh: string[]; en: string[] };
  defaultPriority: number;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "blank",
    nameKey: "template.blank",
    descKey: "template.blankDesc",
    icon: "📄",
    tags: { zh: [], en: [] },
    description: { zh: "", en: "" },
    validationItems: { zh: [], en: [] },
    defaultPriority: 3,
  },
  {
    id: "saas",
    nameKey: "template.saas",
    descKey: "template.saasDesc",
    icon: "☁️",
    tags: { zh: ["SaaS", "订阅", "B2B"], en: ["SaaS", "Subscription", "B2B"] },
    description: {
      zh: "订阅制 SaaS 产品，解决用户痛点并提供持续价值。",
      en: "Subscription-based SaaS product solving user pain points with ongoing value.",
    },
    validationItems: {
      zh: [
        "明确目标用户群体",
        "核心痛点验证（5+ 用户访谈）",
        "MVP 功能清单确定",
        "定价策略制定",
        "竞品分析完成",
        "落地页上线",
        "获得首个付费用户",
        "月留存率 > 40%",
      ],
      en: [
        "Define target user segment",
        "Validate core pain point (5+ user interviews)",
        "Finalize MVP feature list",
        "Define pricing strategy",
        "Complete competitive analysis",
        "Launch landing page",
        "Acquire first paying customer",
        "Monthly retention > 40%",
      ],
    },
    defaultPriority: 4,
  },
  {
    id: "app",
    nameKey: "template.app",
    descKey: "template.appDesc",
    icon: "📱",
    tags: { zh: ["移动端", "App"], en: ["Mobile", "App"] },
    description: {
      zh: "移动应用项目，面向 iOS 和/或 Android 平台。",
      en: "Mobile application targeting iOS and/or Android platforms.",
    },
    validationItems: {
      zh: [
        "目标平台确定（iOS/Android/跨平台）",
        "用户画像和使用场景",
        "核心功能原型设计",
        "技术栈选型",
        "UI/UX 设计完成",
        "TestFlight/内测版发布",
        "收集 20+ 测试反馈",
        "应用商店上架",
      ],
      en: [
        "Choose target platform (iOS/Android/Cross-platform)",
        "Define user persona and use cases",
        "Design core feature prototype",
        "Select tech stack",
        "Complete UI/UX design",
        "Release TestFlight/beta build",
        "Collect 20+ tester feedback",
        "Submit to app store",
      ],
    },
    defaultPriority: 4,
  },
  {
    id: "content",
    nameKey: "template.content",
    descKey: "template.contentDesc",
    icon: "✍️",
    tags: { zh: ["内容", "自媒体"], en: ["Content", "Media"] },
    description: {
      zh: "内容创作项目：博客、视频课程、Newsletter 等。",
      en: "Content creation project: blog, video course, newsletter, etc.",
    },
    validationItems: {
      zh: [
        "确定内容方向和受众",
        "内容发布平台选定",
        "首批 5 篇/期内容完成",
        "建立发布节奏（周更/日更）",
        "达到 100 订阅者/关注者",
        "收到正面用户反馈",
        "探索变现模式",
        "月增长率 > 10%",
      ],
      en: [
        "Define content niche and audience",
        "Choose publishing platform",
        "Complete first 5 pieces of content",
        "Establish publishing cadence",
        "Reach 100 subscribers/followers",
        "Receive positive user feedback",
        "Explore monetization model",
        "Monthly growth > 10%",
      ],
    },
    defaultPriority: 3,
  },
  {
    id: "opensource",
    nameKey: "template.openSource",
    descKey: "template.openSourceDesc",
    icon: "🔓",
    tags: { zh: ["开源", "工具"], en: ["Open Source", "Tool"] },
    description: {
      zh: "开源项目，构建开发者工具或共享库。",
      en: "Open source project building developer tools or shared libraries.",
    },
    validationItems: {
      zh: [
        "明确项目定位和差异化",
        "README 文档完善",
        "CI/CD 流水线配置",
        "单元测试覆盖核心功能",
        "发布首个版本（v0.1）",
        "获得 10+ GitHub Star",
        "处理首个外部 Issue/PR",
        "编写贡献指南",
      ],
      en: [
        "Define project positioning and differentiator",
        "Complete README documentation",
        "Set up CI/CD pipeline",
        "Unit tests cover core features",
        "Release first version (v0.1)",
        "Get 10+ GitHub stars",
        "Handle first external issue/PR",
        "Write contributing guide",
      ],
    },
    defaultPriority: 3,
  },
  {
    id: "ecommerce",
    nameKey: "template.ecommerce",
    descKey: "template.ecommerceDesc",
    icon: "🛒",
    tags: { zh: ["电商", "平台"], en: ["E-commerce", "Platform"] },
    description: {
      zh: "电子商务项目，在线商店或交易平台。",
      en: "E-commerce project: online store or marketplace platform.",
    },
    validationItems: {
      zh: [
        "确定商品类目和供应链",
        "竞品和市场调研",
        "支付系统接入",
        "商品上架（首批 10+）",
        "完成首笔订单",
        "物流流程跑通",
        "客服体系建立",
        "月 GMV 达到目标",
      ],
      en: [
        "Define product category and supply chain",
        "Market and competitive research",
        "Integrate payment system",
        "List first 10+ products",
        "Complete first order",
        "Validate logistics flow",
        "Set up customer service",
        "Reach monthly GMV target",
      ],
    },
    defaultPriority: 4,
  },
];
