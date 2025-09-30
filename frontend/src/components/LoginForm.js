import React, { useState } from "react";

const ENABLE_REGISTER = process.env.REACT_APP_ENABLE_REGISTER === "true";

function LoginForm({ onLogin, onSwitchToRegister }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    onLogin(username, password);
  };

  return (
    <div>
      <h3>ログイン</h3>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="ユーザー名"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="パスワード"
      />
      <button onClick={handleLogin}>ログイン</button>
        {ENABLE_REGISTER && (
          <p>
            アカウントがありませんか？{" "}
            <button onClick={onSwitchToRegister}>登録へ</button>
          </p>
        )}
    </div>
  );
}

export default LoginForm;
