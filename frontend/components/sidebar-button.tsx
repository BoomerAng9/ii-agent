"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelLeft, Clock, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ISession } from "@/typings/agent";
import Cookies from "js-cookie";
import dayjs from "dayjs";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Kumbh_Sans } from "next/font/google";

const kumbh_sans = Kumbh_Sans({
  subsets: ["latin"],
});

interface SidebarButtonProps {
  className?: string;
  workspaceInfo?: string;
}

const SidebarButton = ({ className, workspaceInfo }: SidebarButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const deviceId = Cookies.get("device_id") || "";

  // Get the current session ID from URL parameters
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setActiveSessionId(id);
    }
  }, [searchParams]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const fetchSessions = useCallback(async () => {
    if (!deviceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${deviceId}`
      );

      if (!response.ok) {
        throw new Error(`Error fetching sessions: ${response.statusText}`);
      }

      const data = await response.json();
      setSessions(data.sessions || []);
    } catch {
      setError("Failed to load sessions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  const handleSessionClick = (sessionId: string) => {
    // Redirect to the session or load it in the current view
    window.location.href = `/?id=${sessionId}`;
  };

  // Format the date to a more readable format
  const formatDate = (dateString: string) => {
    try {
      return dayjs(dateString).format("MMM D, YYYY h:mm A");
    } catch {
      return dateString;
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className={cn(
          "fixed top-4 left-4 z-50 bg-[#111113] border border-[#1F1F23] hover:bg-[#18181B] p-2",
          className
        )}
      >
        <PanelLeft className="h-5 w-5 text-white" />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-60 cursor-pointer"
              onClick={toggleSidebar}
            />

            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 h-full w-[300px] bg-[#111113] border-[#1F1F23] z-100 overflow-auto"
            >
              <div className="p-4 border-b border-[#1F1F23] flex items-center gap-3">
                <div
                  className="cursor-pointer flex items-center justify-center w-8 h-8 bg-[#18181B] rounded-md"
                  onClick={toggleSidebar}
                >
                  <PanelLeft className="h-5 w-5 text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <Image
                    src="/logo-only.png"
                    alt="Logo"
                    width={24}
                    height={24}
                    className="rounded-sm"
                  />
                  <span
                    className={`text-white text-lg font-semibold font-serif ${kumbh_sans.className}`}
                  >
                    A.I.M.S.
                  </span>
                </div>
              </div>

              <div className="p-2">
                {isLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  </div>
                ) : error ? (
                  <div className="text-red-400 text-sm p-2">{error}</div>
                ) : sessions.length === 0 ? (
                  <div className="text-gray-400 text-sm p-2">
                    No sessions found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => handleSessionClick(session.id)}
                        className={cn(
                          "p-2 rounded-md cursor-pointer hover:bg-[#18181B] transition-colors",
                          activeSessionId === session.id ||
                            workspaceInfo?.includes(session.id)
                            ? "bg-[#18181B] border border-[#1F1F23]"
                            : ""
                        )}
                      >
                        <div className="text-white text-sm font-medium truncate">
                          {session.name}
                        </div>
                        <div className="text-gray-400 text-xs flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(session.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default SidebarButton;
