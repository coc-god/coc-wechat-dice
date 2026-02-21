"""Parse @mentions and route commands to dice modules."""

from __future__ import annotations

import re
from typing import Optional, Tuple

from dice.roller import roll_expression, roll_d100
from dice.skill_check import skill_check
from dice.san_check import san_check
from dice.opposed import opposed_roll
from dice.combat import fighting_check, firearms_check, dodge_check, damage_roll
from dice.char_gen import generate_characters
from dice.luck import spend_luck
from storage.json_store import JsonStore
from utils.formatter import format_reply, help_text

store = JsonStore()


def parse_command(text: str) -> Tuple[str, str]:
    """Extract command and arguments from message text.

    Returns (command, args) or ("", "") if not a valid command.
    """
    text = text.strip()
    if not text.startswith("."):
        return "", ""

    parts = text.split(None, 1)
    cmd = parts[0].lower()  # e.g. ".r", ".rc", ".san"
    args = parts[1] if len(parts) > 1 else ""
    return cmd, args


def handle_command(text: str, contact_id: str, room_id: str,
                   player_name: str) -> Optional[str]:
    """Process a command and return the response text, or None if not a command."""
    cmd, args = parse_command(text)
    if not cmd:
        return None

    player = store.get_player(contact_id, room_id, player_name)

    result = _dispatch(cmd, args, player)
    if result is None:
        return None

    store.update_player(player)
    return format_reply(player_name, result)


def _dispatch(cmd: str, args: str, player) -> Optional[str]:
    """Route command to the appropriate handler."""

    # Basic rolls
    if cmd in (".r", ".rd", ".roll"):
        return _handle_roll(args, player)

    # Skill check
    if cmd == ".rc":
        return _handle_skill_check(args, player)

    # SAN check
    if cmd == ".san":
        return _handle_san_check(args, player)

    # Opposed roll
    if cmd == ".rop":
        return _handle_opposed(args)

    # Combat
    if cmd == ".fight":
        return _handle_combat("fight", args, player)
    if cmd == ".fire":
        return _handle_combat("fire", args, player)
    if cmd == ".dodge":
        return _handle_combat("dodge", args, player)
    if cmd == ".dmg":
        return _handle_damage(args)

    # Character generation
    if cmd == ".coc":
        return _handle_coc(args)

    # Luck
    if cmd == ".luck":
        return _handle_luck(args, player)

    # Help
    if cmd == ".help":
        return help_text(args)

    return None


def _handle_roll(args: str, player) -> str:
    if not args:
        r = roll_d100()
        player.last_roll = r.total
        return f"🎲 d100 = {r.total}"
    result = roll_expression(args)
    player.last_roll = result.total
    return f"🎲 {result.details}"


def _handle_skill_check(args: str, player) -> str:
    """Parse: 技能名 目标值 [b[N]|p[N]]"""
    match = re.match(
        r'(\S+)\s+(\d+)\s*(?:(b|p)(\d*))?',
        args.strip(), re.IGNORECASE,
    )
    if not match:
        return "❌ 格式: .rc 技能名 目标值 [b/p[数量]]"

    skill_name = match.group(1)
    skill_value = int(match.group(2))
    bp_type = match.group(3)
    bp_count = int(match.group(4)) if match.group(4) else 1

    bonus = bp_count if bp_type and bp_type.lower() == 'b' else 0
    penalty = bp_count if bp_type and bp_type.lower() == 'p' else 0

    result = skill_check(skill_name, skill_value, bonus=bonus, penalty=penalty)

    player.last_roll = result["roll"]
    player.last_skill_name = skill_name
    player.last_skill_value = skill_value

    return result["details"]


def _handle_san_check(args: str, player) -> str:
    """Parse: SAN值 成功损失/失败损失"""
    match = re.match(r'(\d+)\s+(\S+)/(\S+)', args.strip())
    if not match:
        return "❌ 格式: .san SAN值 成功损失/失败损失\n例: .san 55 1d3/1d10"

    san_value = int(match.group(1))
    success_loss = match.group(2)
    fail_loss = match.group(3)

    result = san_check(san_value, success_loss, fail_loss)

    player.san = result["new_san"]
    player.last_roll = result["roll"]

    return result["details"]


def _handle_opposed(args: str) -> str:
    """Parse: 技能1 值1 vs 技能2 值2"""
    match = re.match(
        r'(\S+)\s+(\d+)\s+vs\s+(\S+)\s+(\d+)',
        args.strip(), re.IGNORECASE,
    )
    if not match:
        return "❌ 格式: .rop 技能1 值1 vs 技能2 值2"

    result = opposed_roll(
        match.group(1), int(match.group(2)),
        match.group(3), int(match.group(4)),
    )
    return result["details"]


def _handle_combat(kind: str, args: str, player) -> str:
    match = re.match(r'(\d+)\s*(?:(b|p)(\d*))?', args.strip(), re.IGNORECASE)
    if not match:
        return f"❌ 格式: .{kind} 技能值 [b/p[数量]]"

    skill_value = int(match.group(1))
    bp_type = match.group(2)
    bp_count = int(match.group(3)) if match.group(3) else 1

    bonus = bp_count if bp_type and bp_type.lower() == 'b' else 0
    penalty = bp_count if bp_type and bp_type.lower() == 'p' else 0

    handlers = {
        "fight": fighting_check,
        "fire": firearms_check,
        "dodge": dodge_check,
    }
    result = handlers[kind](skill_value, bonus=bonus, penalty=penalty)

    player.last_roll = result["roll"]
    player.last_skill_name = result["skill_name"]
    player.last_skill_value = skill_value

    return result["details"]


def _handle_damage(args: str) -> str:
    if not args.strip():
        return "❌ 格式: .dmg 表达式 (如 1d3+1d4)"
    result = damage_roll(args.strip())
    return result["details"]


def _handle_coc(args: str) -> str:
    count = 1
    if args.strip().isdigit():
        count = int(args.strip())
    return generate_characters(count)


def _handle_luck(args: str, player) -> str:
    """Parse: set 值 | spend 数量 技能名 技能值"""
    parts = args.strip().split()
    if not parts:
        return f"🍀 当前幸运: {player.luck}\n用法: .luck set 值 / .luck spend 数量 技能名 技能值"

    sub = parts[0].lower()

    if sub == "set" and len(parts) >= 2 and parts[1].isdigit():
        player.luck = int(parts[1])
        return f"🍀 幸运值已设置为: {player.luck}"

    if sub == "spend" and len(parts) >= 4:
        try:
            amount = int(parts[1])
            skill_name = parts[2]
            skill_value = int(parts[3])
        except (ValueError, IndexError):
            return "❌ 格式: .luck spend 数量 技能名 技能值"

        if player.last_roll is None:
            return "❌ 没有找到上次检定记录"

        result = spend_luck(
            player.luck, amount, skill_name,
            player.last_roll, skill_value,
        )
        if result["success"]:
            player.luck = result["new_luck"]
            player.last_roll = result["new_roll"]
        return result["details"]

    return "❌ 用法: .luck set 值 / .luck spend 数量 技能名 技能值"
