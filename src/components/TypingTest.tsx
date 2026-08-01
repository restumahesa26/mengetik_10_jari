"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getRandomWords, Language } from "@/data/words";
import { RotateCcw, Settings2, Home, Users } from "lucide-react";
import MultiplayerModal from "./MultiplayerModal";

type GameStatus = "idle" | "typing" | "finished";

export default function TypingTest() {
  // Configurations
  const [timeConfig, setTimeConfig] = useState<number>(30);
  const [language, setLanguage] = useState<Language>("indonesia");

  // State
  const [status, setStatus] = useState<GameStatus>("idle");
  const [words, setWords] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(timeConfig);

  // Typing Engine State
  const [typedChars, setTypedChars] = useState<string[]>([]);
  const [cursorIndex, setCursorIndex] = useState<number>(0);

  // Analytics State
  const [correctKeystrokes, setCorrectKeystrokes] = useState<number>(0);
  const [incorrectKeystrokes, setIncorrectKeystrokes] = useState<number>(0);
  const [missedKeys, setMissedKeys] = useState<Record<string, number>>({});
  const [fixedKeystrokes, setFixedKeystrokes] = useState<number>(0);
  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeLeftRef = useRef<number>(timeConfig);
  const cursorRef = useRef<HTMLSpanElement>(null);

  const initGame = useCallback((customLang?: Language, customTime?: number) => {
    const targetLang = customLang ?? language;
    const targetTime = customTime ?? timeConfig;

    setWords(getRandomWords(targetLang, 50));
    setStatus("idle");
    setTimeLeft(targetTime);
    timeLeftRef.current = targetTime;
    setTypedChars([]);
    setCursorIndex(0);
    setCorrectKeystrokes(0);
    setIncorrectKeystrokes(0);
    setFixedKeystrokes(0);
    setMissedKeys({});
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Kembali ke atas saat reset
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [language, timeConfig]);

  // Run only once on mount to initialize words without hydration mismatch
  useEffect(() => {
    // Use setTimeout to avoid 'synchronous setState in effect' warning 
    // and ensure it runs after the initial render phase
    const timeout = setTimeout(() => {
      initGame();
    }, 0);
    return () => clearTimeout(timeout);
  }, [initGame]);

  const startGame = () => {
    setStatus("typing");
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);

      if (timeLeftRef.current <= 0) {
        clearInterval(timerRef.current!);
        setStatus("finished");
      }
    }, 1000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Abaikan jika sedang mengetik di input box atau modal sedang terbuka
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        showMultiplayerModal
      ) {
        return;
      }

      if (status === "finished") {
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          initGame();
        }
        return;
      }

      // Ignore modifiers
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key.length === 1) {
        if (status === "idle") startGame();

        // Prevent default scrolling for space
        if (e.key === " ") e.preventDefault();

        const expectedChar = words[cursorIndex];
        const isCorrect = e.key === expectedChar;

        if (isCorrect) {
          setCorrectKeystrokes(prev => prev + 1);
        } else {
          setIncorrectKeystrokes(prev => prev + 1);
          setMissedKeys(prev => ({
            ...prev,
            [expectedChar]: (prev[expectedChar] || 0) + 1
          }));
        }

        setTypedChars(prev => {
          const newTyped = [...prev];
          newTyped[cursorIndex] = e.key;
          return newTyped;
        });

        setCursorIndex(prev => prev + 1);

        // Generate new words if nearing the end (approx 150 characters ~ 3 lines)
        if (words.length - cursorIndex < 150) {
          setWords(prevWords => prevWords + " " + getRandomWords(language, 30));
        }

      } else if (e.key === "Backspace") {
        if (cursorIndex > 0) {
          setCursorIndex(prev => prev - 1);
          setTypedChars(prev => {
            const newTyped = [...prev];
            // If the character was wrong, we are fixing it
            if (newTyped[cursorIndex - 1] !== words[cursorIndex - 1]) {
              setFixedKeystrokes(f => f + 1);
            }
            newTyped[cursorIndex - 1] = ""; // clear the typed char
            return newTyped;
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, cursorIndex, words, language, initGame, showMultiplayerModal]);

  // Auto-scroll kebawah ketika kata baru diload
  useEffect(() => {
    if (cursorRef.current && status === "typing") {
      cursorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [words, status]);

  const renderText = () => {
    return words.split("").map((char, index) => {
      let colorClass = "text-slate-600"; // default grey

      if (index < cursorIndex) {
        if (typedChars[index] === char) {
          colorClass = "text-slate-100"; // correct white
        } else {
          colorClass = "text-red-500 bg-red-500/20 rounded-sm"; // incorrect red
        }
      }

      const isCursor = index === cursorIndex;

      return (
        <span key={index} className="relative">
          <span className={`${colorClass} transition-colors duration-100`}>
            {char}
          </span>
          {isCursor && (
            <span ref={cursorRef} className="absolute bottom-0 left-0 w-full h-[3px] bg-sky-400 animate-pulse rounded-full" />
          )}
        </span>
      );
    });
  };

  const calculateStats = () => {
    const timeInMinutes = timeConfig / 60;
    const totalTyped = typedChars.filter(c => c !== "").length;

    // Standard WPM: (correct chars / 5) / timeInMin
    const wpm = Math.round((correctKeystrokes / 5) / timeInMinutes);

    // Raw WPM: (total chars / 5) / timeInMin
    const rawWpm = Math.round((totalTyped / 5) / timeInMinutes);

    // Accuracy
    const totalKeystrokes = correctKeystrokes + incorrectKeystrokes;
    const accuracy = totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 100) : 0;

    // Top Missed Keys
    const sortedMissed = Object.entries(missedKeys)
      .filter(([char]) => char.trim() !== "") // ignore spaces
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return { wpm, rawWpm, accuracy, sortedMissed };
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-screen px-4">
      {/* Header / Config Menu */}
      <header className={`w-full flex justify-between items-center mb-16 transition-opacity duration-500 ${status === "typing" ? "opacity-0" : "opacity-100"}`}>
        <div className="flex items-center gap-2 text-sky-400 font-bold text-xl tracking-wider">
          <Settings2 size={24} />
          <span>KetikFokus.</span>
        </div>

        {status !== "finished" && (
          <div className="flex gap-8 text-sm font-medium">
            <div className="flex gap-3 bg-slate-800/50 p-2 rounded-lg">
              <button
                onClick={() => setShowMultiplayerModal(true)}
                className="px-4 py-1 rounded-md transition-all bg-violet-600/20 text-violet-400 hover:bg-violet-600 hover:text-white font-bold flex items-center gap-2 border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.3)]"
              >
                <Users size={16} />
                Multiplayer
              </button>
            </div>

            <div className="flex gap-3 bg-slate-800/50 p-2 rounded-lg">
              {[15, 30, 60, 120].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTimeConfig(t);
                    initGame(language, t);
                  }}
                  className={`px-3 py-1 rounded-md transition-colors ${timeConfig === t ? "bg-slate-700 text-sky-300" : "text-slate-500 hover:text-slate-300"}`}
                >
                  {t}s
                </button>
              ))}
            </div>

            <div className="flex gap-3 bg-slate-800/50 p-2 rounded-lg">
              {(["indonesia", "english", "programming"] as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    setLanguage(lang);
                    initGame(lang, timeConfig);
                  }}
                  className={`px-3 py-1 rounded-md transition-colors capitalize ${language === lang ? "bg-slate-700 text-sky-300" : "text-slate-500 hover:text-slate-300"}`}
                >
                  {lang === "programming" ? "Code" : lang}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="w-full relative min-h-[300px] flex flex-col items-center">
        {status !== "finished" ? (
          <>
            <div className="sticky top-8 z-50 text-6xl font-bold text-sky-400/80 mb-8 tracking-tighter bg-slate-900/80 backdrop-blur-md px-10 py-4 rounded-3xl border border-slate-800/50 shadow-2xl shadow-slate-900/80 transition-all duration-300">
              {timeLeft}
            </div>
            <div className="text-2xl md:text-3xl leading-relaxed tracking-wide text-justify opacity-90 select-none cursor-default max-w-full break-words">
              {renderText()}
            </div>

            <div className="mt-16 flex items-center gap-4 text-slate-500">
              <button
                onClick={() => initGame()}
                className="flex items-center gap-2 hover:text-slate-300 transition-colors p-2"
                title="Restart (Tab + Enter)"
              >
                <RotateCcw size={20} />
                <span className="text-sm">Restart Test</span>
              </button>
            </div>
          </>
        ) : (
          /* Dashboard Analytics */
          <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-3xl font-bold text-slate-100 mb-10">Hasil Latihan</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full mb-12">
              <div className="bg-slate-800/40 p-6 rounded-2xl flex flex-col items-center justify-center border border-slate-700/50">
                <span className="text-slate-400 text-sm mb-2 uppercase tracking-widest">WPM</span>
                <span className="text-5xl font-bold text-sky-400">{calculateStats().wpm}</span>
              </div>
              <div className="bg-slate-800/40 p-6 rounded-2xl flex flex-col items-center justify-center border border-slate-700/50">
                <span className="text-slate-400 text-sm mb-2 uppercase tracking-widest">Raw WPM</span>
                <span className="text-4xl font-bold text-slate-200">{calculateStats().rawWpm}</span>
              </div>
              <div className="bg-slate-800/40 p-6 rounded-2xl flex flex-col items-center justify-center border border-slate-700/50">
                <span className="text-slate-400 text-sm mb-2 uppercase tracking-widest">Akurasi</span>
                <span className="text-4xl font-bold text-green-400">{calculateStats().accuracy}%</span>
              </div>
              <div className="bg-slate-800/40 p-6 rounded-2xl flex flex-col items-center justify-center border border-slate-700/50">
                <span className="text-slate-400 text-sm mb-2 uppercase tracking-widest">Karakter</span>
                <div className="text-lg font-mono flex gap-2">
                  <span className="text-green-400" title="Benar">{correctKeystrokes}</span>/
                  <span className="text-red-400" title="Salah">{incorrectKeystrokes}</span>/
                  <span className="text-yellow-400" title="Diperbaiki">{fixedKeystrokes}</span>
                </div>
              </div>
            </div>

            {/* Key Heatmap */}
            <div className="w-full max-w-2xl bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50">
              <h3 className="text-xl font-semibold text-slate-200 mb-6 flex items-center gap-3">
                <span className="w-2 h-6 bg-red-500 rounded-full inline-block"></span>
                Kelemahan Jari (Missed Keys Analytics)
              </h3>

              {calculateStats().sortedMissed.length > 0 ? (
                <div className="flex flex-wrap gap-4">
                  {calculateStats().sortedMissed.map(([char, count], idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-slate-900/50 px-4 py-3 rounded-xl border border-slate-700/30">
                      <span className="text-3xl font-bold text-red-400 min-w-[30px] text-center uppercase">{char}</span>
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-400 uppercase tracking-wider">Salah</span>
                        <span className="text-lg font-bold text-slate-200">{count}x</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-lg">Luar biasa! Tidak ada tombol yang salah tekan.</p>
              )}
            </div>

            <div className="mt-12 flex flex-col sm:flex-row gap-4 items-center">
              <button
                onClick={() => initGame()}
                className="bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold py-4 px-10 rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
              >
                <RotateCcw size={20} />
                Coba Lagi (Tab + Enter)
              </button>

              <button
                onClick={() => initGame()}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-4 px-10 rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-3 border border-slate-700/50"
              >
                <Home size={20} />
                Kembali ke Halaman Utama
              </button>
            </div>
          </div>
        )}
      </main>

      {showMultiplayerModal && (
        <MultiplayerModal onClose={() => setShowMultiplayerModal(false)} />
      )}
    </div>
  );
}
