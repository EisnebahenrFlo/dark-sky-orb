import { useEffect, useState } from "react";

interface Props {
  messages: readonly string[];
  intervalMs?: number;
}

/** Rotates through whimsical loading messages with a 200ms cross-fade. */
export function RotatingLoadingMessage({ messages, intervalMs = 2000 }: Props) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * messages.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((prev) => {
          let next = Math.floor(Math.random() * messages.length);
          if (next === prev) next = (prev + 1) % messages.length;
          return next;
        });
        setVisible(true);
      }, 200);
    }, intervalMs);
    return () => clearInterval(id);
  }, [messages, intervalMs]);

  return (
    <p
      className={`text-sm italic text-muted-foreground transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {messages[idx]}
    </p>
  );
}
