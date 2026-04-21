export type CountrySlug = "thailand" | "vietnam" | "bali" | "kl";

export interface District {
  slug: string;
  name: { ru: string; en: string };
}

export interface City {
  slug: string;
  name: { ru: string; en: string };
  districts?: District[];
}

export interface Country {
  slug: CountrySlug;
  flag: string;
  name: { ru: string; en: string };
  /** Optional short label shown as the picker heading (e.g. "Тай" instead of "Тайланд"). */
  shortName?: { ru: string; en: string };
  cities: City[];
}

export const COUNTRIES: Country[] = [
  {
    slug: "thailand",
    flag: "🇹🇭",
    name: { ru: "Тайланд", en: "Thailand" },
    shortName: { ru: "Тай", en: "Thai" },
    cities: [
      {
        slug: "phuket",
        name: { ru: "Пхукет", en: "Phuket" },
        districts: [
          { slug: "phuket-patong", name: { ru: "Патонг", en: "Patong" } },
          { slug: "phuket-kata", name: { ru: "Ката", en: "Kata" } },
          { slug: "phuket-rawai", name: { ru: "Раваи", en: "Rawai" } },
        ],
      },
      {
        slug: "bangkok",
        name: { ru: "Бангкок", en: "Bangkok" },
        districts: [
          { slug: "bkk-sukhumvit", name: { ru: "Сукхумвит", en: "Sukhumvit" } },
          { slug: "bkk-silom", name: { ru: "Силом", en: "Silom" } },
          { slug: "bkk-thonglor", name: { ru: "Тхонглор", en: "Thonglor" } },
        ],
      },
      { slug: "pattaya", name: { ru: "Паттайя", en: "Pattaya" } },
      { slug: "samui", name: { ru: "Самуи", en: "Samui" } },
    ],
  },
  {
    slug: "vietnam",
    flag: "🇻🇳",
    name: { ru: "Вьетнам", en: "Vietnam" },
    shortName: { ru: "Вьет", en: "Viet" },
    cities: [
      { slug: "hochiminh", name: { ru: "Хошимин", en: "Ho Chi Minh" } },
      { slug: "danang", name: { ru: "Дананг", en: "Da Nang" } },
      { slug: "nhatrang", name: { ru: "Нячанг", en: "Nha Trang" } },
    ],
  },
  {
    slug: "bali",
    flag: "🇮🇩",
    name: { ru: "Бали", en: "Bali" },
    cities: [{ slug: "bali", name: { ru: "Бали", en: "Bali" } }],
  },
  {
    slug: "kl",
    flag: "🇲🇾",
    name: { ru: "Куала-Лумпур", en: "Kuala Lumpur" },
    cities: [{ slug: "kl", name: { ru: "Куала-Лумпур", en: "Kuala Lumpur" } }],
  },
];

export const findCity = (citySlug: string) => {
  for (const c of COUNTRIES) {
    const city = c.cities.find((x) => x.slug === citySlug);
    if (city) return { country: c, city };
  }
  return null;
};
