"""Player state model."""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class Player:
    contact_id: str
    room_id: str
    name: str = ""
    luck: int = 0
    san: int = 0
    last_roll: Optional[int] = None
    last_skill_name: str = ""
    last_skill_value: int = 0

    @property
    def key(self) -> str:
        return f"{self.contact_id}:{self.room_id}"

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "Player":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
