"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { plain } from "./data";
import type { Profile } from "./types";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
export const useAuth = () => useContext(Ctx)!;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile = () => {};
    const unsub = onAuthStateChanged(auth(), (u) => {
      unsubProfile();
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      unsubProfile = onSnapshot(
        doc(db(), "users", u.uid),
        (snap) => {
          setProfile(snap.exists() ? plain<Profile>(snap.id, snap.data()) : null);
          setLoading(false);
        },
        () => setLoading(false),
      );
    });
    return () => {
      unsub();
      unsubProfile();
    };
  }, []);

  const value: AuthState = {
    user,
    profile,
    loading,
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth(), email, password);
    },
    signUp: async (name, email, password) => {
      const cred = await createUserWithEmailAndPassword(auth(), email, password);
      // Rules only allow an inactive employee profile; an admin approves it.
      await setDoc(doc(db(), "users", cred.user.uid), {
        fullName: name, email, role: "employee", active: false, weeklyCapacityHours: 40,
      });
    },
    signOut: () => fbSignOut(auth()),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
