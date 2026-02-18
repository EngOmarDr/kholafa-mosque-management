import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthContextType {
    user: any;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const handleLogout = async () => {
        try {
            localStorage.removeItem("jeelUser");
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            setUser(null);
            setLoading(false);
        }
    };

    useEffect(() => {
        let mounted = true;

        const fetchProfile = async (session: any) => {
            try {
                const { data: profile, error: profileError } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", session.user.id)
                    .single();

                if (profileError || !profile) {
                    console.error("Profile fetch error:", profileError);
                    return null;
                }

                const { data: roleData } = await supabase.rpc('get_user_role', { p_user_id: session.user.id });
                const finalUser = { ...profile, role: roleData || profile.role };

                localStorage.setItem("jeelUser", JSON.stringify(finalUser));
                return finalUser;
            } catch (err) {
                console.error("fetchProfile error:", err);
                return null;
            }
        };

        const initSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error || !session) {
                    if (mounted) {
                        setUser(null);
                        setLoading(false);
                    }
                    return;
                }

                const localData = localStorage.getItem("jeelUser");
                if (localData) {
                    const parsedUser = JSON.parse(localData);
                    if (parsedUser.id === session.user.id) {
                        if (mounted) {
                            setUser(parsedUser);
                            setLoading(false);
                            return;
                        }
                    }
                }

                // If no local data or mismatch, fetch profile
                const fetchedUser = await fetchProfile(session);
                if (mounted) {
                    setUser(fetchedUser);
                    setLoading(false);
                }
            } catch (err) {
                console.error("Session init error:", err);
                if (mounted) {
                    setUser(null);
                    setLoading(false);
                }
            }
        };

        initSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                setUser(null);
                localStorage.removeItem("jeelUser");
                setLoading(false);
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                if (session) {
                    const localData = localStorage.getItem("jeelUser");
                    if (localData) {
                        const parsedUser = JSON.parse(localData);
                        if (parsedUser.id === session.user.id) {
                            setUser(parsedUser);
                            setLoading(false);
                            return;
                        }
                    }

                    // Fetch if not in local storage or mismatch
                    if (mounted) setLoading(true);
                    const fetchedUser = await fetchProfile(session);
                    if (mounted) {
                        setUser(fetchedUser);
                        setLoading(false);
                    }
                } else {
                    if (mounted) {
                        setUser(null);
                        setLoading(false);
                    }
                }
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await handleLogout();
    };

    return (
        <AuthContext.Provider value={{ user, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
