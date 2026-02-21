"""Bot configuration."""

import os

# Wechaty puppet service token
WECHATY_PUPPET_SERVICE_TOKEN = os.environ.get("WECHATY_PUPPET_SERVICE_TOKEN", "")
WECHATY_PUPPET = os.environ.get("WECHATY_PUPPET", "wechaty-puppet-service")
WECHATY_PUPPET_SERVICE_ENDPOINT = os.environ.get("WECHATY_PUPPET_SERVICE_ENDPOINT", "")

# Bot settings
BOT_NAME = os.environ.get("BOT_NAME", "CoC骰娘")
COMMAND_PREFIX = "."

# Data persistence
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
PLAYER_DATA_FILE = os.path.join(DATA_DIR, "players.json")
