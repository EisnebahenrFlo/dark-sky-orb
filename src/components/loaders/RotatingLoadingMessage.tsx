import { useEffect, useRef, useState } from "react";

interface Props {
  messages: readonly string[];
  intervalMs?: number;
  /** Total fade duration (ms) used both for fade-out and fade-in. */
  fadeMs?: number;
}

/** Rotates through whimsical loading messages with a clean cross-fade and no layout shift. */
export function RotatingLoadingMessage({ messages, intervalMs = 3000, fadeMs = 400 }: Props) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * messages.length));
  const [visible, setVisible] = useState(true);
  const idxRef = useRef(idx);
  idxRef.current = idx;

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        const prev = idxRef.current;
        let next = Math.floor(Math.random() * messages.length);
        if (next === prev) next = (prev + 1) % messages.length;
        setIdx(next);
        setVisible(true);
      }, fadeMs);
    }, intervalMs);
    return () => clearInterval(id);
  }, [messages, intervalMs, fadeMs]);

  return (
    <div className="flex min-h-[2rem] items-center justify-center">
      <p
        className="text-base font-semibold italic text-foreground/80"
        style={{
          opacity: visible ? 1 : 0,
          transition: `opacity ${fadeMs}ms ease-in-out`,
        }}
      >
        {messages[idx]}
      </p>
    </div>
  );
}
