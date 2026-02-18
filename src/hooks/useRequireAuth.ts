import { useAuth } from "@/contexts/AuthContext";

export const useRequireAuth = () => {
  const { user, loading } = useAuth();
  return { user, loading };
};
