// components/AIChatbot.jsx
// AI Chatbot interface kiểu ChatGPT mini — giải thích kết quả COCOMO

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";

// Gợi ý câu hỏi nhanh
const QUICK_PROMPTS = [
    "Giải thích kết quả ước lượng cho tôi hiểu",
    "EAF = bao nhiêu thì được coi là cao?",
    "Làm thế nào để giảm Effort xuống 20%?",
    "Nhóm tôi nên có bao nhiêu người?",
    "Dự án Organic khác Embedded như thế nào?",
    "Cost driver nào ảnh hưởng nhất đến schedule?",
];

// Single chat message bubble
function ChatBubble({ msg }) {
    const isUser = msg.role === "user";
    return (
        <div className={`chat-bubble-wrap ${isUser ? "user-wrap" : "ai-wrap"}`}>

            <div className={`chat-bubble ${isUser ? "user-bubble" : "ai-bubble"}`}>
                {isUser ? (
                    <p>{msg.content}</p>
                ) : (
                    <div className="markdown-body">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                )}
                <span className="msg-time">{msg.time}</span>
            </div>
        </div>
    );
}

// Typing indicator animation
function TypingIndicator() {
    return (
        <div className="chat-bubble-wrap ai-wrap">

            <div className="chat-bubble ai-bubble typing-bubble">
                <span className="dot dot1" />
                <span className="dot dot2" />
                <span className="dot dot3" />
            </div>
        </div>
    );
}

export default function AIChatbot({ projectContext }) {
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: projectContext
                ? "Xin chào! Tôi là AI Assistant cho COCOMO Estimator. Tôi đã xem kết quả ước lượng của bạn. Bạn muốn tôi giải thích điều gì?"
                : "Xin chào! Tôi là AI Assistant. Hãy tính toán COCOMO trước để tôi có thể phân tích kết quả cụ thể cho bạn. Hoặc bạn có thể hỏi tôi về lý thuyết COCOMO!",
            time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll khi có tin nhắn mới
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    const sendMessage = async (text) => {
        const content = (text || input).trim();
        if (!content || isLoading) return;

        const now = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        const userMsg = { role: "user", content, time: now };

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput("");
        setIsLoading(true);

        try {
            // Gửi full history (không kể tin nhắn system ban đầu)
            const historyForAPI = newMessages
                .filter((m) => m.role === "user" || m.role === "assistant")
                .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

            const response = await axios.post("http://localhost:8000/api/chat", {
                messages: historyForAPI,
                context: projectContext,
            });

            const aiReply = {
                role: "assistant",
                content: response.data.reply || "Xin lỗi, tôi không hiểu câu hỏi này.",
                time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
            };
            setMessages((prev) => [...prev, aiReply]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: "❌ Không thể kết nối tới AI. Vui lòng kiểm tra backend và API key.",
                    time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
                },
            ]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setMessages([
            {
                role: "assistant",
                content: "Cuộc hội thoại đã được xóa. Tôi vẫn nhớ context dự án của bạn. Bạn muốn hỏi gì?",
                time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
            },
        ]);
    };

    return (
        <div className="chatbot-container">
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="chatbot-header">
                <div className="chatbot-title-group">

                    <div>
                        <h3 className="chatbot-title">AI Assistant</h3>
                        <span className="chatbot-status">
                            <span className="status-dot" /> Online · Gemini 2.5 Flash
                        </span>
                    </div>
                </div>
                <button className="btn-clear-chat" onClick={clearChat} title="Xóa lịch sử chat">
                    Xóa chat
                </button>
            </div>

            {/* ── Context badge (nếu có result) ──────────────────── */}
            {projectContext && (
                <div className="context-badge">
                    Context: {projectContext.kloc} KLOC · {projectContext.mode} · {projectContext.effort} PM · ${projectContext.cost?.toLocaleString()}
                </div>
            )}

            {/* ── Messages ────────────────────────────────────────── */}
            <div className="chat-messages">
                {messages.map((msg, idx) => (
                    <ChatBubble key={idx} msg={msg} />
                ))}
                {isLoading && <TypingIndicator />}
                <div ref={bottomRef} />
            </div>

            {/* ── Quick Prompts ────────────────────────────────────── */}
            <div className="quick-prompts">
                {QUICK_PROMPTS.map((prompt, idx) => (
                    <button
                        key={idx}
                        className="quick-prompt-btn"
                        onClick={() => sendMessage(prompt)}
                        disabled={isLoading}
                    >
                        {prompt}
                    </button>
                ))}
            </div>

            {/* ── Input Area ───────────────────────────────────────── */}
            <div className="chat-input-area">
                <textarea
                    id="chat-input"
                    ref={inputRef}
                    className="chat-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Hỏi về kết quả COCOMO, cost drivers, rủi ro... (Enter để gửi)"
                    rows={2}
                    disabled={isLoading}
                />
                <button
                    id="btn-send-chat"
                    className="btn-send"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isLoading}
                >
                    {isLoading ? <span className="spinner" /> : "↑"}
                </button>
            </div>
        </div>
    );
}
