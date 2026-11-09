'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type Ctor = new () => Recognition;

const ctor = (): Ctor | undefined => {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const noopSubscribe = () => () => {};

/**
 * Speech-to-text for the chat box (browser Web Speech API). `supported` is false where the
 * browser has none (Firefox) so the mic button can be hidden. Each finished phrase is passed to
 * `onText`; the audio is handled by the browser and never stored by Doqto.
 */
export function useDictation(
  lang: string,
  onText: (text: string) => void,
  onError: (code: string) => void,
) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => ctor() !== undefined,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const text = useRef(onText);
  const fail = useRef(onError);
  useEffect(() => {
    text.current = onText;
    fail.current = onError;
  });
  useEffect(() => () => rec.current?.stop(), []);

  const toggle = useCallback(() => {
    if (rec.current) {
      rec.current.stop();
      return;
    }
    const Ctor = ctor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res?.isFinal && res[0]) text.current(res[0].transcript.trim());
      }
    };
    r.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') fail.current(e.error);
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    rec.current = r;
    setListening(true);
    r.start();
  }, [lang]);

  return { supported, listening, toggle };
}
