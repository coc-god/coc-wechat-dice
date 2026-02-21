"""Simple JSON file-based persistence for player data."""

from __future__ import annotations

import json
import os
from typing import Dict

from models.player import Player
from config import PLAYER_DATA_FILE, DATA_DIR


class JsonStore:
    def __init__(self, filepath: str = PLAYER_DATA_FILE):
        self.filepath = filepath
        self._players: Dict[str, Player] = {}
        self._ensure_dir()
        self.load()

    def _ensure_dir(self):
        os.makedirs(os.path.dirname(self.filepath), exist_ok=True)

    def load(self):
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for key, pdata in data.items():
                    self._players[key] = Player.from_dict(pdata)
            except (json.JSONDecodeError, KeyError):
                self._players = {}

    def save(self):
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(
                {k: p.to_dict() for k, p in self._players.items()},
                f, ensure_ascii=False, indent=2,
            )

    def get_player(self, contact_id: str, room_id: str, name: str = "") -> Player:
        key = f"{contact_id}:{room_id}"
        if key not in self._players:
            self._players[key] = Player(
                contact_id=contact_id, room_id=room_id, name=name,
            )
        player = self._players[key]
        if name and player.name != name:
            player.name = name
        return player

    def update_player(self, player: Player):
        self._players[player.key] = player
        self.save()
