"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { Users, Play, Loader2, Trophy, Copy, Check, XCircle, Pause, Square } from "lucide-react";
import MultiplayerTyping from "@/components/MultiplayerTyping";
import { getRandomWords, Language } from "@/data/words";

type Player = {
  name: string;
  wpm: number;
  progress: number;
  status: "waiting" | "typing" | "finished";
};

type Room = {
  id: string;
  host_name: string;
  language: string;
  time_config: number;
  words: string;
  status: "waiting" | "starting" | "typing" | "finished" | "paused";
  start_time: number | null;
  end_time: number | null;
};

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const code = params.code as string;
  const name = searchParams.get("name") || "Guest";

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [hostTimeLeft, setHostTimeLeft] = useState<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isHost = room?.host_name === name;

  useEffect(() => {
    if (!code || !name) return;

    const fetchRoom = async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", code)
        .single();

      if (error || !data) {
        alert("Room tidak ditemukan!");
        router.push("/");
        return;
      }
      setRoom(data as Room);
      setLoading(false);
    };

    fetchRoom();

    // 1. Setup Channel
    const channel = supabase.channel(`room:${code}`, {
      config: {
        presence: { key: name },
        broadcast: { self: true },
      },
    });
    channelRef.current = channel;

    // 2. Listen to Presence (Player join/leave)
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const newPlayers: Record<string, Player> = {};

      for (const [key, presences] of Object.entries(state)) {
        if (presences.length > 0) {
          const p = presences[0] as unknown as { wpm: number, progress: number, status: "waiting" | "typing" | "finished" };
          newPlayers[key] = {
            name: key,
            wpm: p.wpm || 0,
            progress: p.progress || 0,
            status: p.status || "waiting",
          };
        }
      }
      setPlayers(newPlayers);
    });

    // 3. Listen to DB changes (Host starts game)
    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${code}` },
      (payload) => {
        const newRoom = payload.new as Room;
        setRoom((prev) => {
          if (!prev) return newRoom;
          // Protect against stale Supabase broadcasts reverting optimistic word appends
          // Words should only grow during an active game.
          if (newRoom.status !== "waiting" && newRoom.words.length < prev.words.length) {
            return { ...newRoom, words: prev.words };
          }
          return newRoom;
        });
      }
    );

    // 4. Listen to Broadcasts (Typing progress)
    channel.on("broadcast", { event: "progress" }, (payload) => {
      const { player, wpm, progress, status } = payload.payload;
      setPlayers((prev) => ({
        ...prev,
        [player]: {
          name: player,
          wpm,
          progress,
          status,
        },
      }));
    });

    // Subscribe and track presence
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          wpm: 0,
          progress: 0,
          status: "waiting",
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, name, router]);

  // Handle countdown logic when status becomes "starting"
  useEffect(() => {
    if (room?.status === "starting" && room.start_time) {
      const interval = setInterval(() => {
        const diff = Math.ceil((room.start_time! - Date.now()) / 1000);
        if (diff > 0) {
          setCountdown(diff);
        } else {
          setCountdown(null);
          setRoom((prev) => prev ? { ...prev, status: "typing" } : null);
          clearInterval(interval);
          
          if (isHost) {
            supabase.from("rooms").update({ status: "typing" }).eq("id", code);
          }
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [room?.status, room?.start_time, room?.time_config, isHost, code]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdateRoom = async (updates: Partial<Room>) => {
    if (!room) return;
    
    if (updates.language && updates.language !== room.language) {
      updates.words = getRandomWords(updates.language as Language, 50);
    }

    setRoom({ ...room, ...updates } as Room);

    await supabase
      .from("rooms")
      .update(updates)
      .eq("id", code);
  };

  const handleCloseRoom = async () => {
    if (isHost) {
      // Host closes the room -> delete from DB
      await supabase.from("rooms").delete().eq("id", code);
    }
    router.push("/");
  };

  const handleStartGame = async () => {
    if (!room) return;
    const startTime = Date.now() + 4000; // 4 seconds from now (3..2..1..GO)
    // End time is startTime + time_config
    const endTime = startTime + (room.time_config * 1000);

    await supabase
      .from("rooms")
      .update({ status: "starting", start_time: startTime, end_time: endTime })
      .eq("id", code);
  };

  const handlePause = async () => {
    if (!room || hostTimeLeft === null) return;
    await supabase.from("rooms").update({ 
      status: "paused", 
      time_config: hostTimeLeft,
      end_time: null
    }).eq("id", code);
  };

  const handleResume = async () => {
    if (!room) return;
    const startTime = Date.now() + 4000;
    const endTime = startTime + (room.time_config * 1000);
    await supabase.from("rooms").update({ 
      status: "starting", 
      start_time: startTime,
      end_time: endTime
    }).eq("id", code);
  };

  const handleStop = async () => {
    await supabase.from("rooms").update({ status: "finished" }).eq("id", code);
  };

  const handleAppendWords = async (newWords: string) => {
    if (!room) return;
    // Update local state immediately for instant feedback
    setRoom({ ...room, words: newWords });
    // Sync to Supabase for other players
    await supabase.from("rooms").update({ words: newWords }).eq("id", code);
  };

  const handleProgress = async (wpm: number, progress: number, status: string, timeLeft: number) => {
    if (isHost) setHostTimeLeft(timeLeft);

    if (channelRef.current) {
      await channelRef.current.send({
        type: "broadcast",
        event: "progress",
        payload: { player: name, wpm, progress, status },
      });
      // Update self locally immediately for smooth UI
      setPlayers((prev) => ({
        ...prev,
        [name]: { name, wpm, progress, status: status as "waiting" | "typing" | "finished" }
      }));
    }
  };

  if (loading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 font-mono">
      {/* Header Room */}
      <header className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-12 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
        <div className="flex-1 w-full">
          <h1 className="text-3xl font-bold text-violet-400 flex items-center gap-3 mb-2">
            <Users /> Room: {code}
            <button onClick={handleCopyCode} className="text-slate-400 hover:text-white transition-colors ml-2" title="Salin Kode Room">
              {copied ? <Check size={24} className="text-green-400" /> : <Copy size={24} />}
            </button>
          </h1>
          <p className="text-slate-400 text-sm">
            Host: <span className="text-slate-200 font-semibold">{room.host_name}</span> |
            Bahasa: <span className="text-slate-200 capitalize">{room.language}</span> |
            Waktu: <span className="text-slate-200">{room.time_config / 60} menit</span>
          </p>
          
          {/* Host Settings */}
          {room.status === "waiting" && isHost && (
            <div className="flex flex-col gap-4 mt-6 bg-slate-900/50 p-4 rounded-xl w-full md:w-fit border border-slate-800">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-slate-400 text-sm mr-2 w-14">Waktu:</span>
                {[60, 120, 180, 300, 600].map((t) => (
                  <button
                    key={t}
                    onClick={() => handleUpdateRoom({ time_config: t })}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors font-semibold ${room.time_config === t ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700/50"}`}
                  >
                    {t / 60}m
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-slate-400 text-sm mr-2 w-14">Bahasa:</span>
                {(["indonesia", "english", "programming"]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleUpdateRoom({ language: lang })}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors font-semibold capitalize ${room.language === lang ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700/50"}`}
                  >
                    {lang === "programming" ? "Code" : lang}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {room.status === "waiting" && isHost && (
          <div className="mt-6 md:mt-0 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={handleCloseRoom}
              className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 border border-red-500/30 whitespace-nowrap"
            >
              <XCircle size={20} />
              Tutup Room
            </button>
            <button
              onClick={handleStartGame}
              className="bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 px-8 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              <Play size={20} />
              Mulai Pertandingan
            </button>
          </div>
        )}

        {/* Host Game Controls (Typing or Paused) */}
        {(room.status === "typing" || room.status === "paused") && isHost && (
          <div className="mt-6 md:mt-0 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {room.status === "typing" ? (
              <button
                onClick={handlePause}
                className="bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 border border-amber-500/30 whitespace-nowrap"
              >
                <Pause size={20} />
                Pause
              </button>
            ) : (
              <button
                onClick={handleResume}
                className="bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:scale-105 active:scale-95 whitespace-nowrap"
              >
                <Play size={20} />
                Lanjutkan
              </button>
            )}
            <button
              onClick={handleStop}
              className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 border border-red-500/30 whitespace-nowrap"
            >
              <Square size={20} />
              Hentikan
            </button>
          </div>
        )}

        {room.status === "waiting" && !isHost && (
          <div className="mt-6 md:mt-0 flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-3 text-amber-400 bg-amber-400/10 px-6 py-4 rounded-xl border border-amber-400/20 w-full sm:w-auto justify-center">
              <Loader2 className="animate-spin" size={20} />
              <span>Menunggu host memulai...</span>
            </div>
            <button
              onClick={handleCloseRoom}
              className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 border border-red-500/30 whitespace-nowrap w-full sm:w-auto"
            >
              <XCircle size={20} />
              Keluar
            </button>
          </div>
        )}

        {/* Finished Game Controls */}
        {room.status === "finished" && (
          <div className="mt-6 md:mt-0 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={handleCloseRoom}
              className="bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 px-8 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              <Check size={20} />
              {isHost ? "Tutup Room & Kembali" : "Kembali ke Beranda"}
            </button>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto">
        {/* Leaderboard / Progress Bars */}
        <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-700/50 mb-12">
          <h2 className="text-xl font-semibold mb-6 text-slate-300 flex items-center gap-2">
            <Trophy className="text-amber-400" size={20} /> Live Leaderboard
          </h2>
          <div className="space-y-4">
            {Object.values(players)
              .sort((a, b) => b.progress - a.progress)
              .map((p, idx) => (
                <div key={p.name} className="relative w-full h-12 bg-slate-900 rounded-xl overflow-hidden border border-slate-700/50">
                  {/* Progress Fill */}
                  <div
                    className={`absolute top-0 left-0 h-full transition-all duration-300 ${p.name === name ? 'bg-violet-600/30 border-r-2 border-violet-500' : 'bg-slate-700/50 border-r-2 border-slate-500'}`}
                    style={{ width: `${Math.max(p.progress, 2)}%` }}
                  ></div>

                  {/* Content */}
                  <div className="absolute inset-0 flex items-center justify-between px-4 z-10">
                    <div className="flex items-center gap-3">
                      <span className={`font-bold ${idx === 0 ? 'text-amber-400' : 'text-slate-400'}`}>#{idx + 1}</span>
                      <span className={`font-semibold ${p.name === name ? 'text-white' : 'text-slate-300'}`}>
                        {p.name} {p.name === name && '(Kamu)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-bold">
                      <span className="text-sky-400">{p.wpm} WPM</span>
                      <span className="text-slate-400 w-12 text-right">{Math.round(p.progress)}%</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Game Area */}
        {countdown !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
            <div className="text-[15rem] font-bold text-violet-500 animate-pulse drop-shadow-[0_0_50px_rgba(139,92,246,0.8)]">
              {countdown}
            </div>
          </div>
        )}

        {(room.status === "typing" || room.status === "finished" || room.status === "paused") && (
          <MultiplayerTyping
            words={room.words}
            timeConfig={room.time_config}
            endTime={room.end_time}
            isHost={isHost}
            playerName={name}
            roomCode={code}
            roomLanguage={room.language as Language}
            roomStatus={room.status as "typing" | "finished" | "paused"}
            onProgress={handleProgress}
            onAppendWords={handleAppendWords}
          />
        )}
      </main>
    </div>
  );
}
