import React, { useState } from "react";

interface Message {
  role: "user" | "system";
  text: string;
  status?: "allowed" | "prohibited" | "neutral";
}

const ChatBox: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const processMessage = (text: string): Message => {
    const lower = text.toLowerCase();

    if (lower.includes("bicycle")) {
      return {
        role: "system",
        text:
          "✅ According to Singapore Customs and MITI Malaysia, bicycles (HS Code 8712) are allowed.\n\n" +
          "Checklist:\n• Commercial Invoice\n• Packing List\n• Export Declaration (MY)\n• Import Permit (SG, if required)\n• Shipping arrangement",
        status: "allowed",
      };
    }

    if (!lower.includes("hs code")) {
      return {
        role: "system",
        text:
          "ℹ️ Could you provide the HS Code (tariff code) of your item? This helps me check regulations more accurately.",
        status: "neutral",
      };
    }

    return {
      role: "system",
      text:
        "❌ Sorry, this item may be restricted or prohibited. Please verify HS Code classification and check destination country regulations.",
      status: "prohibited",
    };
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);

    const systemMsg = processMessage(input);
    setMessages((prev) => [...prev, systemMsg]);

    setInput("");
  };

  return (
    <div className="chat-container">
      <h2>Export Assistant Chat</h2>
      <div className="chat-box">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`message ${msg.role}`}
            style={
              msg.role === "system"
                ? msg.status === "allowed"
                  ? { border: "2px solid #4CAF50" }
                  : msg.status === "prohibited"
                  ? { border: "2px solid #F44336" }
                  : { border: "1px solid #ccc" }
                : {}
            }
          >
            {msg.text.split("\n").map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={input}
          placeholder="Type your item details..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};

export default ChatBox;
