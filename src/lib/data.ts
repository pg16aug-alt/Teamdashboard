"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, type DocumentData, type QueryConstraint, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

/** Firestore Timestamps become ISO strings so the rest of the app deals in plain data. */
export function plain<T>(id: string, data: DocumentData): T {
  const out: DocumentData = { id };
  for (const [k, v] of Object.entries(data)) out[k] = v instanceof Timestamp ? v.toDate().toISOString() : v;
  return out as T;
}

/** Live collection (or sub-collection path). `key` must change when `constraints` change. */
export function useCollection<T>(path: string | null, constraints: QueryConstraint[] = [], key = ""): { data: T[] | null; error: string | null } {
  const [state, setState] = useState<{ data: T[] | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    if (!path) return;
    return onSnapshot(
      query(collection(db(), path), ...constraints),
      (snap) => setState({ data: snap.docs.map((d) => plain<T>(d.id, d.data())), error: null }),
      (err) => setState({ data: [], error: err.message }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key]);
  return state;
}

import { collectionGroup, getDocs } from "firebase/firestore";
import type { Submission } from "./types";

/** Every submission across all tasks (small team, so one live read is fine). */
export function useAllSubmissions(enabled: boolean): Submission[] | null {
  const [subs, setSubs] = useState<Submission[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      collectionGroup(db(), "submissions"),
      (snap) =>
        setSubs(snap.docs.map((d) => ({ ...plain<Submission>(d.id, d.data()), taskId: d.ref.parent.parent!.id }))),
      () => setSubs([]),
    );
  }, [enabled]);
  return subs;
}

/** One-off read of a task's submissions (used by the client report export). */
export async function fetchSubmissions(taskId: string): Promise<Submission[]> {
  const snap = await getDocs(collection(db(), "tasks", taskId, "submissions"));
  return snap.docs.map((d) => ({ ...plain<Submission>(d.id, d.data()), taskId })).sort((a, b) => a.version - b.version);
}
