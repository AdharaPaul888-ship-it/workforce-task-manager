import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AppContext";

export const ProtectedRoute = ({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission?: string;
}) => {
  const { user, can, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !can(permission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};
