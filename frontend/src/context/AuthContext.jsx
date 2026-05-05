import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Lấy session ban đầu
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                setSession(session);
                setUser(session?.user ?? null);
            })
            .catch((err) => {
                console.error("Lỗi lấy session auth:", err);
            })
            .finally(() => {
                setLoading(false);
            });

        // Lắng nghe sự kiện auth (login, logout, refresh token...)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // Các hàm Helper
    const register = async (email, password) => {
        return supabase.auth.signUp({ email, password });
    };

    const login = async (email, password) => {
        return supabase.auth.signInWithPassword({ email, password });
    };

    const logout = async () => {
        return supabase.auth.signOut();
    };

    const value = {
        session,
        user,
        register,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
