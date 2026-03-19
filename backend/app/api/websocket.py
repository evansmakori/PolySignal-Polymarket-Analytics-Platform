"""WebSocket endpoints for real-time updates."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import asyncio
import datetime

from ..services.market_service import MarketService
from ..models.market import MarketFilter
from ..core.database import get_pool


def _json_safe(obj):
    """Recursively convert non-JSON-serializable types to strings."""
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    if isinstance(obj, float) and (obj != obj):
        return None
    return obj


async def _get_dashboard_events(limit: int = 100):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                event_id,
                MAX(event_title) as event_title,
                MAX(event_slug) as event_slug,
                COUNT(DISTINCT market_id) as market_count,
                SUM(volume_total) as total_volume,
                SUM(liquidity) as total_liquidity,
                MAX(snapshot_ts) as last_updated,
                MAX(predictive_score) as best_score,
                CASE
                    WHEN BOOL_OR(COALESCE(lifecycle_status, 'active') = 'active') THEN 'active'
                    WHEN BOOL_AND(lifecycle_status = 'archived') THEN 'archived'
                    ELSE 'resolved'
                END as lifecycle_status,
                CASE
                    WHEN BOOL_OR(COALESCE(lifecycle_status, 'active') = 'active') THEN NULL
                    ELSE MAX(resolved_at)
                END as resolved_at
            FROM polymarket_market_stats
            WHERE event_id IS NOT NULL
              AND snapshot_ts = (
                SELECT MAX(s2.snapshot_ts)
                FROM polymarket_market_stats s2
                WHERE s2.market_id = polymarket_market_stats.market_id
              )
            GROUP BY event_id
            HAVING BOOL_OR(COALESCE(lifecycle_status, 'active') = 'active')
                OR (
                    NOT BOOL_AND(lifecycle_status = 'archived')
                    AND MAX(resolved_at) > NOW() - INTERVAL '7 days'
                )
            ORDER BY total_volume DESC NULLS LAST
            LIMIT $1
        """, limit)
        return [dict(r) for r in rows]


router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections and broadcasting."""

    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, key: str):
        await websocket.accept()
        if key not in self.active_connections:
            self.active_connections[key] = set()
        self.active_connections[key].add(websocket)

    def disconnect(self, websocket: WebSocket, key: str):
        if key in self.active_connections:
            self.active_connections[key].discard(websocket)
            if not self.active_connections[key]:
                del self.active_connections[key]

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast(self, message: dict, key: str):
        if key in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[key]:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.add(connection)
            for connection in disconnected:
                self.active_connections[key].discard(connection)


manager = ConnectionManager()


@router.websocket("/ws/markets/{market_id}")
async def websocket_market_updates(websocket: WebSocket, market_id: str):
    """WebSocket endpoint for real-time market updates."""
    await manager.connect(websocket, market_id)


    try:
        market_data = await MarketService.get_market_by_id(market_id)
        if market_data:
            await manager.send_personal_message({"type": "initial", "data": _json_safe(market_data)}, websocket)
        else:
            await manager.send_personal_message({"type": "error", "message": "Market not found"}, websocket)
            await websocket.close()
            return

        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
            except asyncio.TimeoutError:
                market_data = await MarketService.get_market_by_id(market_id)
                if market_data:
                    await manager.send_personal_message({"type": "update", "data": _json_safe(market_data)}, websocket)
            except WebSocketDisconnect:
                break
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, market_id)


@router.websocket("/ws/markets")
async def websocket_all_markets(websocket: WebSocket):
    """WebSocket endpoint for updates on all markets."""
    await websocket.accept()

    try:
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=15.0)
            except asyncio.TimeoutError:
                filters = MarketFilter(limit=100)
                markets = await MarketService.get_markets(filters)
                await websocket.send_json({"type": "markets_update", "data": _json_safe(markets)})
            except WebSocketDisconnect:
                break
    except WebSocketDisconnect:
        pass
    finally:
        await websocket.close()


@router.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    """WebSocket endpoint for live dashboard event-card updates."""
    # Accept all origins — nginx handles routing, App Platform handles TLS
    await websocket.accept(subprotocol=None)

    try:
        initial = await _get_dashboard_events(limit=100)
        await websocket.send_json({"type": "events_initial", "data": _json_safe(initial)})

        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
            except asyncio.TimeoutError:
                events = await _get_dashboard_events(limit=100)
                await websocket.send_json({"type": "events_update", "data": _json_safe(events)})
            except WebSocketDisconnect:
                break
    except WebSocketDisconnect:
        pass
    finally:
        await websocket.close()
