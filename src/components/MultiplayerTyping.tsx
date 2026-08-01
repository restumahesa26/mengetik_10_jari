"use client";

import { useState, useEffect, useRef } from "react";
import { getRandomWords, Language } from "@/data/words";

interface Props {
  words: string;
  timeConfig: number;
  endTime: number | null;
  isHost: boolean;
  playerName: string;
  roomCode: string;
  roomLanguage: Language;
  roomStatus: "typing" | "finished" | "paused";
  onProgress: (wpm: number, progress: number, status: string, timeLeft: number) => void;
  onAppendWords: (newWords: string) => void;
}

export default function MultiplayerTyping({ words, timeConfig, endTime, isHost, playerName, roomCode, roomLanguage, roomStatus, onProgress, onAppendWords }: Props) {
  const [timeLeft, setTimeLeft] = useState<number>(timeConfig);
  const [prevTimeConfig, setPrevTimeConfig] = useState<number>(timeConfig);
  const [typedChars, setTypedChars] = useState<string[]>([]);
  const [cursorIndex, setCursorIndex] = useState<number>(0);
  const [correctKeystrokes, setCorrectKeystrokes] = useState<number>(0);
  const [incorrectKeystrokes, setIncorrectKeystrokes] = useState<number>(0);
  const [isRestoring, setIsRestoring] = useState(true);
  const [visibleWordsLength, setVisibleWordsLength] = useState<number>(300);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeLeftRef = useRef<number>(timeLeft);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const onProgressRef = useRef(onProgress);
  const isFetchingWords = useRef(false);

  const sessionKey = `ketikfokus_room_${roomCode}_${playerName}`;

  const isGameFinished = timeLeft <= 0 || roomStatus === "finished";
  const isGamePaused = roomStatus === "paused";

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  // Sync initial time based on endTime
  useEffect(() => {
    if (endTime && roomStatus !== 'paused') {
      const diff = Math.ceil((endTime - Date.now()) / 1000);
      setTimeLeft(Math.max(0, diff));
    }
  }, [endTime, roomStatus]);

  // Load session from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(sessionKey);
      if (saved && roomStatus !== 'finished') {
        const data = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTypedChars(data.typedChars || []);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCursorIndex(data.cursorIndex || 0);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCorrectKeystrokes(data.correctKeystrokes || 0);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIncorrectKeystrokes(data.incorrectKeystrokes || 0);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisibleWordsLength(Math.max(300, (data.cursorIndex || 0) + 300));
      }
    } catch (e) {
      console.error("Failed to restore session", e);
    } finally {
      setIsRestoring(false);
    }
  }, [sessionKey, roomStatus]);

  // Save session continuously
  useEffect(() => {
    if (isRestoring || roomStatus === 'finished') return;
    const data = { typedChars, cursorIndex, correctKeystrokes, incorrectKeystrokes };
    sessionStorage.setItem(sessionKey, JSON.stringify(data));
  }, [typedChars, cursorIndex, correctKeystrokes, incorrectKeystrokes, sessionKey, isRestoring, roomStatus]);

  // Clear session when finished
  useEffect(() => {
    if (roomStatus === 'finished') {
      sessionStorage.removeItem(sessionKey);
    }
  }, [roomStatus, sessionKey]);

  if (timeConfig !== prevTimeConfig) {
    setPrevTimeConfig(timeConfig);
    setTimeLeft(timeConfig);
  }

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Update visible words length locally
  useEffect(() => {
    if (visibleWordsLength - cursorIndex < 150) {
      setVisibleWordsLength((prev) => Math.min(words.length, prev + 200));
    }
  }, [cursorIndex, visibleWordsLength, words.length]);

  // Handle words update reset
  useEffect(() => {
    if (words.length - cursorIndex > 150) {
      isFetchingWords.current = false;
    }
  }, [words.length, cursorIndex]);

  // Handle timer
  useEffect(() => {
    if (isGameFinished || isGamePaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      let newTimeLeft = 0;
      if (endTime) {
        newTimeLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      } else {
        newTimeLeft = timeLeftRef.current - 1;
      }

      timeLeftRef.current = newTimeLeft;
      setTimeLeft(newTimeLeft);

      if (newTimeLeft <= 0) {
        clearInterval(timerRef.current!);
      }
    }, 100); // Check more frequently for precise sync with endTime

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGameFinished, isGamePaused, endTime]);

  // Update progress to host/other players
  useEffect(() => {
    const timeInMinutes = (timeConfig - timeLeftRef.current) / 60 || 0.01;
    const wpm = Math.round((correctKeystrokes / 5) / timeInMinutes);
    const progress = Math.min((cursorIndex / words.length) * 100, 100);
    
    onProgressRef.current(wpm, progress, isGameFinished ? "finished" : "typing", timeLeftRef.current);
  }, [correctKeystrokes, cursorIndex, words.length, isGameFinished, timeConfig]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGameFinished || isGamePaused || isRestoring) return;

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key.length === 1) {
        if (e.key === " ") e.preventDefault();

        // Prevent typing out of bounds
        if (cursorIndex >= words.length) return;

        const expectedChar = words[cursorIndex];
        const isCorrect = e.key === expectedChar;

        if (isCorrect) {
          setCorrectKeystrokes(prev => prev + 1);
        } else {
          setIncorrectKeystrokes(prev => prev + 1);
        }

        setTypedChars(prev => {
          const newTyped = [...prev];
          newTyped[cursorIndex] = e.key;
          return newTyped;
        });

        const nextIndex = cursorIndex + 1;
        setCursorIndex(nextIndex);

        // Auto-load words globally for ANY user that reaches near the end of global words
        if (!isFetchingWords.current && words.length - nextIndex < 150) {
          isFetchingWords.current = true;
          const newWords = words + " " + getRandomWords(roomLanguage, 50);
          onAppendWords(newWords);
        }
      } else if (e.key === "Backspace") {
        if (cursorIndex > 0) {
          setCursorIndex(prev => prev - 1);
          setTypedChars(prev => {
            const newTyped = [...prev];
            newTyped[cursorIndex - 1] = "";
            return newTyped;
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGameFinished, isGamePaused, isRestoring, cursorIndex, words, isHost, roomCode, roomLanguage, onAppendWords]);

  // Auto-scroll kebawah
  useEffect(() => {
    if (cursorRef.current && !isGameFinished) {
      cursorRef.current.scrollIntoView({ behavior: "auto", block: "center" });
    }
  }, [cursorIndex, isGameFinished]);

  const renderText = () => {
    const displayedWords = words.substring(0, visibleWordsLength);
    
    return displayedWords.split("").map((char, index) => {
      let colorClass = "text-slate-600"; 

      if (index < cursorIndex) {
        if (typedChars[index] === char) {
          colorClass = "text-slate-100"; 
        } else {
          colorClass = "text-red-500 bg-red-500/20 rounded-sm"; 
        }
      }

      const isCursor = index === cursorIndex;

      return (
        <span key={index} className="relative">
          <span className={`${colorClass} transition-colors duration-100`}>
            {char}
          </span>
          {isCursor && (
            <span ref={cursorRef} className="absolute bottom-0 left-0 w-full h-[3px] bg-violet-400 animate-pulse rounded-full" />
          )}
        </span>
      );
    });
  };

  const calculateFinalStats = () => {
    const timeInMinutes = timeConfig / 60;
    const wpm = Math.round((correctKeystrokes / 5) / timeInMinutes);
    const totalKeystrokes = correctKeystrokes + incorrectKeystrokes;
    const accuracy = totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 100) : 0;
    return { wpm, accuracy };
  };

  if (isRestoring) return null;

  return (
    <div className="w-full flex flex-col items-center">
      {!isGameFinished ? (
        <>
          <div className="sticky top-8 z-50 text-6xl font-bold text-violet-400/80 mb-8 tracking-tighter bg-slate-900/80 backdrop-blur-md px-10 py-4 rounded-3xl border border-slate-800/50 shadow-2xl shadow-slate-900/80 transition-all duration-300">
            {timeLeft}
          </div>
          {isGamePaused && (
            <div className="text-amber-400 bg-amber-400/10 border border-amber-400/20 px-6 py-2 rounded-xl mb-8 font-bold animate-pulse">
              Pertandingan Di-pause oleh Host
            </div>
          )}
          <div className={`text-2xl md:text-3xl leading-relaxed tracking-wide text-justify select-none cursor-default max-w-full break-words ${isGamePaused ? 'opacity-50 blur-sm transition-all duration-500' : 'opacity-90'}`}>
            {renderText()}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center mt-12 p-8 bg-slate-800/40 rounded-3xl border border-slate-700/50">
          <h2 className="text-3xl font-bold text-white mb-6">Waktu Habis!</h2>
          <div className="flex gap-8">
            <div className="text-center">
              <p className="text-slate-400 mb-2 uppercase tracking-widest text-sm">WPM Akhir</p>
              <p className="text-5xl font-bold text-violet-400">{calculateFinalStats().wpm}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 mb-2 uppercase tracking-widest text-sm">Akurasi</p>
              <p className="text-5xl font-bold text-green-400">{calculateFinalStats().accuracy}%</p>
            </div>
          </div>
          <p className="mt-8 text-slate-400">Silakan lihat Leaderboard di atas untuk melihat peringkat Anda.</p>
        </div>
      )}
    </div>
  );
}
