"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import styles from "./page.module.css";

const ROOM = "emergency-92hd83hdk3jhd83jdh38d";

type Message = {
  id: number;
  room: string;
  sender: string;
  body: string;
  created_at: string;
  is_deleted?: boolean;
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const chatRef = useRef<HTMLDivElement>(null);

  function renderContent(text: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        if (part.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
          return (
            <img
              key={i}
              src={part}
              alt="shared"
              style={{ maxWidth: "220px", borderRadius: "12px", marginTop: 6 }}
            />
          );
        }

        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#60a5fa" }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  }

  useEffect(() => {
    const saved = localStorage.getItem("chat_name");
    if (saved) setName(saved);
  }, []);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel("room-" + ROOM)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `room=eq.${ROOM}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMessage = payload.new as Message;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMessage.id)) return prev;
              return [...prev, newMessage];
            });
          }

          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Message;
            setMessages((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m))
            );
          }

          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Message;
            setMessages((prev) =>
              prev.filter((m) => m.id !== deleted.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!chatRef.current) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  async function fetchMessages() {
    setLoading(true);

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("room", ROOM)
      .order("created_at", { ascending: true });

    if (data) setMessages(data as Message[]);
    setLoading(false);
  }

  function confirmName() {
    if (!draftName.trim()) return;
    const finalName = draftName.trim();
    setName(finalName);
    localStorage.setItem("chat_name", finalName);
  }

  async function sendMessage() {
    if (!text.trim() || !name || sending) return;

    setSending(true);

    await supabase.from("messages").insert([
      {
        room: ROOM,
        sender: name,
        body: text.trim(),
      },
    ]);

    setText("");
    setSending(false);
  }

  async function deleteMessage(id: number) {
    await supabase
      .from("messages")
      .update({ is_deleted: true })
      .eq("id", id);
  }

  async function editMessage(id: number, newText: string) {
    if (!newText.trim()) return;

    await supabase
      .from("messages")
      .update({ body: newText.trim() })
      .eq("id", id);

    setEditingId(null);
    setEditText("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") sendMessage();
  }

  if (!name) {
    return (
      <div className={styles.joinScreen}>
        <div className={styles.joinCard}>
          <h2>Join Oomfie Chat</h2>
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmName()}
            placeholder="Enter your name..."
            className={styles.input}
          />
          <button
            onClick={confirmName}
            disabled={!draftName.trim()}
            className={styles.button}
            style={{ opacity: draftName.trim() ? 1 : 0.5 }}
          >
            Join Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.chatPanel}>
        <div className={styles.header}>
          <div># oomfie-chat</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Logged in as {name}
          </div>
        </div>

        <div ref={chatRef} className={styles.chatBox}>
          {loading ? (
            <div className={styles.systemMessage}>Loading...</div>
          ) : (
            messages.map((m) => {
              const isMe = m.sender === name;

              return (
                <div
                  key={m.id}
                  className={styles.messageRow}
                  style={{
                    justifyContent: isMe ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    className={`${styles.bubble} ${
                      isMe ? styles.me : styles.other
                    }`}
                  >
                    {!isMe && (
                      <div className={styles.sender}>{m.sender}</div>
                    )}

                    {m.is_deleted ? (
                      <div style={{ opacity: 0.5, fontStyle: "italic" }}>
                        Message deleted
                      </div>
                    ) : editingId === m.id ? (
                      <>
                        <input
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          style={{
                            width: "100%",
                            marginBottom: 6,
                            padding: 6,
                            borderRadius: 8,
                            border: "none",
                          }}
                        />
                        <button
                          onClick={() => editMessage(m.id, editText)}
                          style={{
                            fontSize: 12,
                            padding: "4px 8px",
                            borderRadius: 8,
                            border: "none",
                          }}
                        >
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <div>{renderContent(m.body)}</div>

                        {isMe && (
                          <div
                            style={{
                              marginTop: 6,
                              fontSize: 10,
                              opacity: 0.6,
                              display: "flex",
                              gap: 10,
                            }}
                          >
                            <span
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                setEditingId(m.id);
                                setEditText(m.body);
                              }}
                            >
                              Edit
                            </span>
                            <span
                              style={{ cursor: "pointer" }}
                              onClick={() => deleteMessage(m.id)}
                            >
                              Delete
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className={styles.inputRow}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message #oomfie-chat"
            disabled={sending}
            className={styles.messageInput}
          />
          <button
            onClick={sendMessage}
            disabled={!text.trim() || sending}
            className={styles.sendButton}
            style={{ opacity: text.trim() ? 1 : 0.5 }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}