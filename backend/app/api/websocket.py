"""WebSocket endpoints for real-time updates."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import asyncio
import json
import datetime

from ..services.market_service import MarketService
from ..models.market import MarketFilter


def _json_safe(obj):
    """Recursively convert non-JSON-serializable types to strings."""
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    if isinstance(obj, float) and (obj != obj):  # NaN
        return None
    return obj

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections and broadcasting."""
    
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, market_id: str):
        await websocket.accept()
        if market_id not in self.active_connections:
            self.active_connections[market_id] = set()
        self.active_connections[market_id].add(websocket)
    
    def disconnect(self, websocket: WebSocket, market_id: str):
        if market_id in self.active_connections:
            self.active_connections[market_id].discard(websocket)
            if not self.active_connections[market_id]:
                del self.active_connections[market_id]
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)
    
    async def broadcast(self, message: dict, market_id: str):
        if market_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[market_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.add(connection)
            for connection in disconnected:
                self.active_connections[market_id].discard(connection)


manager = ConnectionManager()


@router.websocket("/ws/markets/{market_id}")
async def websocket_market_updates(websocket: WebSocket, market_id: str):
    """
    WebSocket endpoint for real-time market updates.
    Sends updates every 10 seconds.
    """
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
