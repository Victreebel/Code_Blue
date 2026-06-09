import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/react";
import { getUserPreferences, setUserPreferences } from "@workspace/api-client-react";

const LS_MINIMAP = "acls-minimap-visible";
const LS_TAGS = "acls-tags-visible";

export interface UserPreferences {
  minimapVisible: boolean;
  tagsVisible: boolean;
}

function readLocalPrefs(): UserPreferences {
  return {
    minimapVisible: localStorage.getItem(LS_MINIMAP) !== "false",
    tagsVisible: localStorage.getItem(LS_TAGS) !== "false",
  };
}

function writeLocalPrefs(prefs: UserPreferences) {
  localStorage.setItem(LS_MINIMAP, String(prefs.minimapVisible));
  localStorage.setItem(LS_TAGS, String(prefs.tagsVisible));
}

export function useUserPreferences() {
  const { user, isLoaded } = useUser();
  const [prefs, setPrefsState] = useState<UserPreferences>(readLocalPrefs);
  const [synced, setSynced] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      userIdRef.current = null;
      setSynced(true);
      setSyncError(null);
      return;
    }

    const userId = user.id;
    userIdRef.current = userId;
    setSynced(false);
    setSyncError(null);

    getUserPreferences(userId)
      .then((serverPrefs) => {
        setPrefsState(serverPrefs);
        writeLocalPrefs(serverPrefs);
        setSynced(true);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to sync preferences";
        setSyncError(message);
        setSynced(true);
      });
  }, [isLoaded, user]);

  const saveToServer = useCallback((next: UserPreferences) => {
    const userId = userIdRef.current;
    if (!userId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setUserPreferences(userId, next).catch(() => {});
    }, 500);
  }, []);

  const setPrefs = useCallback(
    (updater: UserPreferences | ((prev: UserPreferences) => UserPreferences)) => {
      setPrefsState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        writeLocalPrefs(next);
        saveToServer(next);
        return next;
      });
    },
    [saveToServer],
  );

  return { prefs, setPrefs, synced, syncError };
}
