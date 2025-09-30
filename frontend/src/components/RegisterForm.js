import React, { useState } from "react";

function RegisterForm({ onRegistered }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = () => {
    fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
      }),
    }).then((res) => {
      if (res.ok) {
        alert("登録成功！ログインしてください。");
        onRegistered();
      } else {
        alert("登録失敗");
      }
    });
  };

  return (
    <div>
      <h3>新規登録</h3>
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
      <button onClick={handleRegister}>登録</button>
      <p>
        すでにアカウントがありますか？{" "}
        <button onClick={onRegistered}>ログインへ</button>
      </p>
    </div>
  );
}

export default RegisterForm;
