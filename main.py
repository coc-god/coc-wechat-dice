"""Entry point — CoC 7.0 Dice Bot for WeChat using Wechaty."""

import asyncio
import os
import sys

from wechaty import Wechaty, Message, WechatyOptions
from handlers.message_handler import handle_command
from config import (
    WECHATY_PUPPET_SERVICE_TOKEN,
    WECHATY_PUPPET,
    WECHATY_PUPPET_SERVICE_ENDPOINT,
    BOT_NAME,
)


class CoCDiceBot(Wechaty):

    async def on_login(self, contact):
        print(f"[登录成功] {contact}")

    async def on_logout(self, contact):
        print(f"[已登出] {contact}")

    async def on_message(self, msg: Message):
        # Ignore self messages
        if msg.is_self():
            return

        room = msg.room()
        # Only respond in group chats when @mentioned
        if room is None:
            return

        await room.ready()
        # Check if bot is mentioned
        mention_self = await msg.mention_self()
        if not mention_self:
            return

        # Extract text without @mention
        text = await msg.mention_text()
        text = text.strip()
        if not text:
            return

        talker = msg.talker()
        contact_id = talker.contact_id
        player_name = talker.name

        response = handle_command(
            text=text,
            contact_id=contact_id,
            room_id=room.room_id,
            player_name=player_name,
        )

        if response:
            await room.say(response)


async def main():
    # Set environment variables if not already set
    if WECHATY_PUPPET_SERVICE_TOKEN:
        os.environ.setdefault("WECHATY_PUPPET_SERVICE_TOKEN", WECHATY_PUPPET_SERVICE_TOKEN)
    if WECHATY_PUPPET:
        os.environ.setdefault("WECHATY_PUPPET", WECHATY_PUPPET)
    if WECHATY_PUPPET_SERVICE_ENDPOINT:
        os.environ.setdefault("WECHATY_PUPPET_SERVICE_ENDPOINT", WECHATY_PUPPET_SERVICE_ENDPOINT)

    bot = CoCDiceBot(WechatyOptions(name=BOT_NAME))
    await bot.start()


if __name__ == "__main__":
    print(f"🎲 CoC 7.0 骰娘启动中...")
    asyncio.run(main())
