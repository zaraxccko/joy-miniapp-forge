import logo from "@/assets/logo.webp";
import { useI18n, tFor, type Lang } from "@/lib/i18n";
import { haptic } from "@/lib/telegram";

interface SplashLanguageProps {
  onPicked: () => void;
}

export const SplashLanguage = ({ onPicked }: SplashLanguageProps) => {
  const setLang = useI18n((s) => s.setLang);

  const pick = (l: Lang) => {
    haptic("medium");
    setLang(l);
    onPicked();
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background flex flex-col items-center justify-center px-6 py-10 gradient-hero">
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <img
          src={logo}
          alt="Love Shop"
          className="w-56 h-56 rounded-[2rem] shadow-glow object-cover mb-6 animate-pop"
        />
        <h1 className="font-display font-extrabold text-3xl text-foreground text-center">
          Love Shop
        </h1>
        <p className="text-foreground/70 mt-2 text-center">
          {tFor("ru", "splash.subtitle")} · {tFor("en", "splash.subtitle")}
        </p>
      </div>

      <div className="w-full space-y-3">
        <button
          onClick={() => pick("ru")}
          className="w-full bg-card text-foreground font-bold py-4 rounded-2xl shadow-card flex items-center justify-center gap-3 active:scale-[0.98] transition-[var(--transition-base)]"
        >
          <span className="text-2xl">🇷🇺</span> Русский
        </button>
        <button
          onClick={() => pick("en")}
          className="w-full bg-card text-foreground font-bold py-4 rounded-2xl shadow-card flex items-center justify-center gap-3 active:scale-[0.98] transition-[var(--transition-base)]"
        >
          <span className="text-2xl">🇬🇧</span> English
        </button>
      </div>
    </div>
  );
};
