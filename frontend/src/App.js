import React, { useState, useEffect, useRef } from "react";
import RegisterForm from "./components/RegisterForm";
import LoginForm from "./components/LoginForm";

const ENABLE_REGISTER = process.env.REACT_APP_ENABLE_REGISTER === "true";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [isConnected, setIsConnected] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const ws = useRef(null);

  // 履歴取得
  useEffect(() => {
    if (token) {
      fetch("/messages", {
        headers: {
          token: token,
        },
      })
        .then((res) => {
          if (res.status === 401) {
            handleLogout();
            throw new Error("Unauthorized: Please login again");
          }
          return res.json();
        })
        .then((data) => {
          if (Array.isArray(data)) {
            const history = data.map((m) => `💬 ${m.username}: ${m.message}`);
            setMessages((prev) => [...prev, ...history]);
          } else {
            console.error("Unexpected response:", data);
          }
        })
        .catch((err) => console.error(err));
    }
  }, [token]);

  // ログイン処理
  const handleLogin = (usernameInput, passwordInput) => {
    fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: usernameInput,
        password: passwordInput,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.access_token) {
          localStorage.removeItem("token");
          localStorage.removeItem("username");

          localStorage.setItem("token", data.access_token);
          localStorage.setItem("username", usernameInput);

          setToken(data.access_token);
          setUsername(usernameInput);
          connectWebSocket(usernameInput, data.access_token);
        } else {
          alert("ログイン失敗");
        }
      });
  };

  // WebSocket接続
  const connectWebSocket = (username, token) => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";

    // React dev server で動かしている場合（3000番）
    const isDevServer = window.location.port === "3000";

    const wsHost = isDevServer ? "localhost:8000" : window.location.host;
    const wsUrl = `${protocol}://${wsHost}/ws/${token}`;

ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
    };

    ws.current.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]);
    };

    ws.current.onclose = () => {
      console.log("WebSocket closed");
      handleLogout();
    };
  };

  // メッセージ送信
  const sendMessage = () => {
    if (ws.current && input) {
      ws.current.send(input);
      setInput("");
    }
  };

  // 履歴クリア
  const clearMessages = () => {
    fetch("/messages", {
      method: "DELETE",
      headers: {
        token: token,
      },
    }).then(() => {
      setMessages([]);
    });
  };

  // ログアウト処理
  const handleLogout = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setToken("");
    setUsername("");
    setIsConnected(false);
    setMessages([]);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ display: "flex", alignItems: "center" }}>
        <img
          src="/simplefastapichatati.png"
          alt="chat icon"
          style={{ width: "24px", height: "24px", marginRight: "8px" }}
        />
        Simple FastAPI Chat
      </h2>

      {!token ? (
        <div>
            {ENABLE_REGISTER && isRegister ? (
              <RegisterForm onRegistered={() => setIsRegister(false)} />
            ) : (
              <LoginForm
                onLogin={handleLogin}
                onSwitchToRegister={() =>
                  ENABLE_REGISTER && setIsRegister(true)
                }
              />
            )}
          </div>
      ) : !isConnected ? (
        <div>
          <button onClick={handleLogout} style={{ marginLeft: "10px" }}>
            ログアウト
          </button>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: "10px", fontWeight: "bold" }}>
            ユーザー: {username}
            <button
              onClick={handleLogout}
              style={{ marginLeft: "20px", padding: "5px" }}
            >
              ログアウト
            </button>
          </div>

          <div
            style={{
              border: "1px solid #ccc",
              padding: "10px",
              height: "300px",
              overflowY: "scroll",
              marginBottom: "10px",
            }}
          >
            {messages.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力"
          />
          <button onClick={sendMessage}>送信</button>
          <button onClick={clearMessages} style={{ marginLeft: "10px" }}>
            履歴クリア
          </button>
        </>
      )}
    </div>
  );
}

export default App;
