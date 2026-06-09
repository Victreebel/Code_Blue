import { useState, useEffect, useRef, useCallback } from "react";
import { getUserPreferences, setUserPreferences } from "@workspace/api-client-react";

const LS_USER_ID = "acls-user-id";
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

function getOrCreateUserId(): string {
  let id = localStorage.getItem(LS_USER_ID);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(LS_USER_ID, id);
  }
  return id;
}

export function useUserPreferences() {
  const [prefs, setPrefsState] = useState<UserPreferences>(readLocalPrefs);
  const [synced, setSynced] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const userId = getOrCreateUserId();
    userIdRef.current = userId;

    getUserPreferences(userId)
      .then((serverPrefs) => {
        setPrefsState(serverPrefs);
        writeLocalPrefs(serverPrefs);
        setSynced(true);
      })
      .catch(() => {
        setSynced(true);
      });
  }, []);

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

  return { prefs, setPrefs, synced };
}
