# ============================
# Frontend build stage
# ============================
FROM node:20 AS frontend-build
WORKDIR /app/frontend

# package.json と lock ファイルをコピーして install
COPY frontend/package*.json ./
RUN npm install

# ソースをコピーして build
COPY frontend/ ./
RUN npm run build

# ============================
# Backend stage
# ============================
FROM python:3.11-slim AS backend
WORKDIR /app

# Python 依存関係
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ソースをコピー
COPY backend ./backend

# フロントのビルド成果物を backend/static にコピー
COPY --from=frontend-build /app/frontend/build ./frontend_build

# FastAPI アプリ起動
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
