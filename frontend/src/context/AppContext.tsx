import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import apiClient from "../services/apiClient";

export interface AuthBadges {
  leavesPending: number;
  myOpenTasks: number;
  timer: { running: boolean; startedAt: string | null; accumulatedSeconds: number };
}

export interface AuthContextValue {
  user: any;
  setUser: React.Dispatch<React.SetStateAction<any>>;
  permissions: string[];
  setPermissions: React.Dispatch<React.SetStateAction<string[]>>;
  can: (perm: string) => boolean;
  badges: AuthBadges;
  setBadges: React.Dispatch<React.SetStateAction<AuthBadges>>;
  tenantId: string | null;
  setTenantId: React.Dispatch<React.SetStateAction<string | null>>;
  loading: boolean;
  refreshUser: () => Promise<void>;
  refreshBadges: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [badges, setBadges] = useState<AuthBadges>({
    leavesPending: 0,
    myOpenTasks: 0,
    timer: { running: false, startedAt: null, accumulatedSeconds: 0 },
  });
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const can = (perm: string) => {
    if (permissions.includes("*")) return true;
    return permissions.includes(perm);
  };

  const refreshBadges = useCallback(() => {
    apiClient
      .get("/me/badges")
      .then((resp) => setBadges(resp.data.data))
      .catch(() => {});
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await apiClient.get("/auth/me");
      const userData = me.data.data;
      setUser(userData);
      setPermissions(userData.permissions || []);
      setTenantId(userData.tenant || null);
      refreshBadges();
    } catch {
      setUser(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [refreshBadges]);

  useEffect(() => {
    if (localStorage.getItem("token")) {
      refreshUser();
    } else {
      setLoading(false);
    }
  }, [refreshUser]);

  // Refresh badges every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      if (localStorage.getItem("token")) refreshBadges();
    }, 60000);
    return () => clearInterval(interval);
  }, [refreshBadges]);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        permissions,
        setPermissions,
        can,
        badges,
        setBadges,
        tenantId,
        setTenantId,
        loading,
        refreshUser,
        refreshBadges,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
