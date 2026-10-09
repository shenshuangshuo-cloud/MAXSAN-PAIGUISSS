# -*- coding: utf-8 -*-
"""排柜工具云端同步后端
FastAPI + PostgreSQL(SQLite本地兜底) + SSE 实时广播
云端为权威数据源：打开拉取、修改推送、SSE 通知其他使用者刷新。
"""
import asyncio
import json
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

app = FastAPI(title="排柜工具同步服务", docs_url="/api/docs", openapi_url="/api/openapi.json")

# ---------------- 数据库 ----------------
if DATABASE_URL:
    import psycopg2
    import psycopg2.pool

    _pool = psycopg2.pool.SimpleConnectionPool(1, 5, dsn=DATABASE_URL)

    def get_conn():
        return _pool.getconn()

    def release_conn(conn):
        _pool.putconn(conn)

    _CREATE_SQL = (
        "CREATE TABLE IF NOT EXISTS sync_data ("
        " key TEXT PRIMARY KEY, data TEXT NOT NULL,"
        " version BIGINT NOT NULL DEFAULT 0,"
        " updated_at TIMESTAMPTZ DEFAULT now())"
    )
else:
    import sqlite3

    _local_db = os.path.join(BASE_DIR, "local.db")

    def get_conn():
        return sqlite3.connect(_local_db, check_same_thread=False)

    def release_conn(conn):
        conn.close()

    _CREATE_SQL = (
        "CREATE TABLE IF NOT EXISTS sync_data ("
        " key TEXT PRIMARY KEY, data TEXT NOT NULL,"
        " version BIGINT NOT NULL DEFAULT 0,"
        " updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
    )


def init_db():
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(_CREATE_SQL)
        conn.commit()
        cur.close()
    finally:
        release_conn(conn)


# ---------------- SSE 广播 ----------------
_subscribers: list[asyncio.Queue] = []


async def broadcast(key: str, version: int):
    msg = json.dumps({"key": key, "version": version}, ensure_ascii=False)
    for q in list(_subscribers):
        try:
            await q.put(msg)
        except Exception:
            pass


# ---------------- API ----------------
@app.get("/api/master")
def get_master():
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT data, version FROM sync_data WHERE key='master'")
        row = cur.fetchone()
        cur.close()
        if not row:
            return {"data": [], "version": 0}
        return {"data": json.loads(row[0]), "version": row[1]}
    finally:
        release_conn(conn)


@app.put("/api/master")
async def put_master(payload: dict):
    data = payload.get("data", [])
    conn = get_conn()
    try:
        cur = conn.cursor()
        if DATABASE_URL:
            cur.execute(
                "INSERT INTO sync_data(key,data,version,updated_at) VALUES('master',%s,1,now())"
                " ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data, version=sync_data.version+1, updated_at=now()"
                " RETURNING version",
                (json.dumps(data, ensure_ascii=False),),
            )
        else:
            cur.execute(
                "INSERT INTO sync_data(key,data,version,updated_at) VALUES('master',?,1,CURRENT_TIMESTAMP)"
                " ON CONFLICT(key) DO UPDATE SET data=excluded.data, version=sync_data.version+1, updated_at=CURRENT_TIMESTAMP"
                " RETURNING version",
                (json.dumps(data, ensure_ascii=False),),
            )
        version = cur.fetchone()[0]
        conn.commit()
        cur.close()
    finally:
        release_conn(conn)
    await broadcast("master", version)
    return {"ok": True, "version": version}


@app.get("/api/events")
async def events(request: Request):
    q: asyncio.Queue = asyncio.Queue()
    _subscribers.append(q)

    async def gen():
        try:
            yield ": connected\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            if q in _subscribers:
                _subscribers.remove(q)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# 静态托管前端页面（必须放在 API 路由之后）
app.mount("/", StaticFiles(directory=os.path.join(BASE_DIR, "public"), html=True), name="public")

init_db()
