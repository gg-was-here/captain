"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How many recent reply times are kept per bot. */
const MAX_SAMPLES = 10;
/** Fewer than this and "usually" would be a guess. */
const MIN_SAMPLES = 3;
/** Longer than this is a stuck or abandoned turn, not a reply time worth learning from. */
const MAX_SAMPLE_MS = 30 * 60_000;

const storageKey = (agent: string) => `captain:reply-ms:${agent}`;

/** The median of the recent reply times, once there are enough of them. */
export function typicalReplyMs(samples: readonly number[]): number | undefined {
  if (samples.length < MIN_SAMPLES) return undefined;
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** The samples with a new reply time added, keeping only the latest few. */
export function withSample(samples: readonly number[], ms: number): number[] {
  if (!Number.isFinite(ms) || ms <= 0 || ms > MAX_SAMPLE_MS) return [...samples];
  return [...samples, Math.round(ms)].slice(-MAX_SAMPLES);
}

/** A running time: "12s", "1m 05s". */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

/** A rough duration: "~8s", "~25s", "~2 min". */
export function formatTypical(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 10) return `~${Math.max(1, Math.round(seconds))}s`;
  if (seconds < 60) return `~${Math.round(seconds / 5) * 5}s`;
  return `~${Math.round(seconds / 60)} min`;
}

function readSamples(agent: string): number[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(agent)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

/**
 * Times the bot's turn while it works, and learns how long this bot usually takes. Only turns the user
 * started from an idle chat count: a resumed turn's start is unknown, and a turn that failed, was
 * cancelled, was steered or waited on the user's answer isn't a normal reply time.
 */
export function useReplyTimer(
  agent: string,
  { busy, paused, failed }: { readonly busy: boolean; readonly paused: boolean; readonly failed: boolean },
) {
  const [startedAt, setStartedAt] = useState<number>();
  const [now, setNow] = useState(0);
  const [typicalMs, setTypicalMs] = useState<number>();
  // Set by a send from an idle chat; the turn it starts is the one worth recording.
  const submitted = useRef(false);
  const record = useRef(false);

  useEffect(() => setTypicalMs(typicalReplyMs(readSamples(agent))), [agent]);

  useEffect(() => {
    if (busy && startedAt === undefined) {
      const start = Date.now();
      setStartedAt(start);
      setNow(start);
      record.current = submitted.current;
      submitted.current = false;
    } else if (!busy && startedAt !== undefined) {
      if (record.current && !failed) {
        const samples = withSample(readSamples(agent), Date.now() - startedAt);
        try {
          localStorage.setItem(storageKey(agent), JSON.stringify(samples));
        } catch {
          // Storage full or blocked: the hint just stays as it was.
        }
        setTypicalMs(typicalReplyMs(samples));
      }
      setStartedAt(undefined);
    }
  }, [agent, busy, failed, startedAt]);

  useEffect(() => {
    if (paused) record.current = false;
  }, [paused]);

  useEffect(() => {
    if (!busy) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [busy]);

  /** Call when the user sends a message: from an idle chat it starts a timed turn; mid-turn it steers. */
  const onSend = useCallback((midTurn: boolean) => {
    if (midTurn) record.current = false;
    else submitted.current = true;
  }, []);
  /** Call when the user stops the reply. */
  const onCancel = useCallback(() => {
    record.current = false;
  }, []);

  return {
    elapsedMs: busy && startedAt !== undefined ? Math.max(0, now - startedAt) : undefined,
    typicalMs,
    onSend,
    onCancel,
  };
}
