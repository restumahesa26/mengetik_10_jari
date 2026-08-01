"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { getRandomWords } from "@/data/words";
import { X, Users, Plus, LogIn, Loader2, Zap } from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function MultiplayerModal({ onClose }: Props) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreateRoom = async () => {
    if (!nickname.trim()) {
      setError("Nickname tidak boleh kosong!");
      return;
    }

    setLoading(true);
    setError("");

    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    const words = getRandomWords("indonesia", 50);

    const { error: dbError } = await supabase.from("rooms").insert({
      id: code,
      host_name: nickname.trim(),
      language: "indonesia",
      time_config: 300,
      words: words,
      status: "waiting",
      start_time: null,
      end_time: null
    });

    if (dbError) {
      console.error(dbError);
      setError("Gagal membuat room. Coba lagi.");
      setLoading(false);
      return;
    }

    router.push(`/room/${code}?name=${encodeURIComponent(nickname.trim())}`);
  };

  const handleJoinRoom = async () => {
    if (!nickname.trim()) {
      setError("Nickname tidak boleh kosong!");
      return;
    }
    if (!roomCode.trim()) {
      setError("Kode Room tidak boleh kosong!");
      return;
    }

    setLoading(true);
    setError("");

    const code = roomCode.trim().toUpperCase();

    // Check if room exists
    const { data, error: dbError } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", code)
      .single();

    if (dbError || !data) {
      setError("Room tidak ditemukan!");
      setLoading(false);
      return;
    }

    router.push(`/room/${code}?name=${encodeURIComponent(nickname.trim())}`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 min-h-[350px] flex flex-col justify-center overflow-hidden">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors disabled:opacity-50 z-50"
        >
          <X size={24} />
        </button>

        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-6 py-8 animate-in fade-in duration-500">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500/20 rounded-full blur-xl animate-pulse"></div>
              <div className="bg-slate-800 p-4 rounded-full border border-violet-500/50 relative z-10 shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                <Loader2 className="text-violet-400 animate-spin" size={48} />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                <Zap className="text-amber-400 animate-pulse" size={20} />
                Mempersiapkan Arena
              </h3>
              <p className="text-slate-400 text-sm animate-pulse">Menghubungkan ke server realtime...</p>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Users className="text-violet-500" />
              Mode Multiplayer
            </h2>

            {error && (
              <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm border border-red-500/30">
                {error}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nickname Kamu
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Misal: ProTypist"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                  maxLength={15}
                />
              </div>

              <div className="border-t border-slate-800 pt-6 space-y-4">
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                >
                  <Plus size={20} />
                  Buat Room Baru
                </button>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-slate-700"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-500 text-sm">ATAU</span>
                  <div className="flex-grow border-t border-slate-700"></div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJoinRoom();
                    }}
                    placeholder="Kode Room (5 Huruf)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all text-center uppercase tracking-widest font-bold"
                    maxLength={5}
                  />
                  <button
                    type="button"
                    onClick={handleJoinRoom}
                    disabled={loading}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                  >
                    <LogIn size={20} />
                    Gabung
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
