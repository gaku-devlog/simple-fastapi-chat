import os
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import List
from .models import ChatMessage, User, SessionLocal
from passlib.context import CryptContext
from fastapi.staticfiles import StaticFiles
from pathlib import Path

load_dotenv()

# =====================================================
# アプリ初期化
# =====================================================
app = FastAPI()

allow_origins = [os.getenv("ALLOW_ORIGINS", "")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# JWT 設定
# =====================================================
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not set in environment variables")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def get_password_hash(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# =====================================================
# Pydantic モデル
# =====================================================
class UserRegister(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

# =====================================================
# ユーザー登録
# =====================================================
ENABLE_REGISTER = os.getenv("ENABLE_REGISTER", "true").lower() == "true"

if ENABLE_REGISTER:

    @app.post("/register")
    def register(user: UserRegister, db: Session = Depends(get_db)):
        existing_user = db.query(User).filter(User.username == user.username).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already registered")

        hashed_pw = get_password_hash(user.password)
        new_user = User(username=user.username, hashed_password=hashed_pw)
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {"msg": "User registered successfully"}

# =====================================================
# ログイン（JWT発行）
# =====================================================
@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(data={"sub": db_user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# =====================================================
# WebSocket 管理
# =====================================================
class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        disconnected = []
        for conn in self.active_connections:
            try:
                await conn.send_text(message)
            except Exception:
                disconnected.append(conn)
        for conn in disconnected:
            self.disconnect(conn)

manager = WebSocketManager()

# JWT 認証関数
def verify_jwt_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
    
# FastAPI 用の認証依存関数
def get_current_user(token: str = Header(...)):
    username = verify_jwt_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or missing token")
    return username    

# =====================================================
# WebSocket エンドポイント
# =====================================================
@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str, db: Session = Depends(get_db)):
    username = verify_jwt_token(token)
    if not username:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket)
    await manager.broadcast(f"👋 {username} joined")

    try:
        while True:
            data = await websocket.receive_text()
            chat = ChatMessage(username=username, message=data)
            db.add(chat)
            db.commit()
            db.refresh(chat)

            await manager.broadcast(f"💬 {username}: {data}")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)
        await manager.broadcast(f"👋 {username} left")

# =====================================================
# メッセージ取得
# =====================================================
@app.get("/messages")
def get_messages(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    messages = db.query(ChatMessage).all()
    return [{"username": m.username, "message": m.message, "timestamp": m.timestamp} for m in messages]

# =====================================================
# メッセージ削除（全削除）
# =====================================================
@app.delete("/messages")
def clear_messages(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    db.query(ChatMessage).delete()
    db.commit()
    return {"msg": f"All messages cleared by {current_user}"}

# =====================================================
# フロントエンドの静的ファイルをマウント
# =====================================================
backend_dir = Path(__file__).resolve().parent

# ローカルで frontend/build が生成された場合
frontend_build_local = backend_dir.parent / "frontend" / "build"

# プロジェクト直下に frontend_build がある場合
frontend_local = backend_dir.parent / "frontend_build"

# Docker ビルド後の配置
frontend_docker = Path("/app/frontend_build")

# 存在するものを優先して使う
frontend_dir = None
if frontend_build_local.exists():
    frontend_dir = frontend_build_local
elif frontend_local.exists():
    frontend_dir = frontend_local
elif frontend_docker.exists():
    frontend_dir = frontend_docker

if frontend_dir and frontend_dir.exists():
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")
