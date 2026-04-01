import os
import re
from typing import Optional, List
import httpx
from models import Scenario, OptimizationResult


# ─── Rules Engine: generates factually correct draft answers ───

def _build_dc_lookup(scenario: Optional[Scenario]) -> dict:
    """Build lookup of DC name/id -> {stock, demand, surplus, capacity}."""
    if not scenario:
        return {}
    lookup = {}
    for dc in scenario.dcs:
        gap = dc.current_stock - dc.demand_forecast
        info = {
            "id": dc.id,
            "name": dc.name,
            "stock": dc.current_stock,
            "demand": dc.demand_forecast,
            "capacity": dc.capacity,
            "surplus": gap,
            "status": "SURPLUS" if gap > 0 else "SHORTAGE",
            "utilization": round(dc.current_stock / dc.capacity * 100, 1),
        }
        # Index by multiple keys for fuzzy matching
        lookup[dc.id.lower()] = info
        lookup[dc.name.lower()] = info
        lookup[dc.id.replace("DC-", "").lower()] = info
    return lookup


def _find_dc_in_question(question: str, dc_lookup: dict) -> Optional[dict]:
    """Find which DC the user is asking about."""
    q = question.lower()
    # Check longest names first to avoid partial matches
    for key in sorted(dc_lookup.keys(), key=len, reverse=True):
        if key in q:
            return dc_lookup[key]
    return None


def _find_transfer_direction(question: str) -> Optional[str]:
    """Determine if user is asking about shipping TO or FROM a DC."""
    q = question.lower()
    # "ship to X", "send to X", "transfer to X", "move to X"
    if re.search(r'\b(ship|send|transfer|move|stock)\s+(to|into)\b', q):
        return "TO"
    # "ship from X", "take from X", "pull from X"
    if re.search(r'\b(ship|send|take|pull|move|stock)\s+from\b', q):
        return "FROM"
    # "ship X to Y" pattern
    if re.search(r'\bto\s+(atlanta|chicago|los angeles|seattle|dallas|new york|dc-)', q):
        return "TO"
    return None


def _get_biggest_shortage(dc_lookup: dict) -> Optional[dict]:
    """Find DC with the biggest shortage."""
    shortage_dcs = [v for v in dc_lookup.values() if v["surplus"] < 0]
    if not shortage_dcs:
        return None
    # Deduplicate (same DC indexed multiple ways)
    seen = set()
    unique = []
    for dc in shortage_dcs:
        if dc["id"] not in seen:
            seen.add(dc["id"])
            unique.append(dc)
    return min(unique, key=lambda x: x["surplus"])


def _get_biggest_surplus(dc_lookup: dict) -> Optional[dict]:
    """Find DC with the biggest surplus."""
    surplus_dcs = [v for v in dc_lookup.values() if v["surplus"] > 0]
    if not surplus_dcs:
        return None
    seen = set()
    unique = []
    for dc in surplus_dcs:
        if dc["id"] not in seen:
            seen.add(dc["id"])
            unique.append(dc)
    return max(unique, key=lambda x: x["surplus"])


def _is_supply_chain_question(question: str) -> bool:
    """Check if the question is related to supply chain / inventory."""
    q = question.lower()
    keywords = [
        "ship", "stock", "inventory", "dc", "warehouse", "transfer", "demand",
        "supply", "surplus", "shortage", "capacity", "cost", "carbon", "freight",
        "stockout", "rebalance", "redeploy", "optimize", "atlanta", "chicago",
        "los angeles", "seattle", "dallas", "new york", "dc-", "lax", "chi",
        "atl", "sea", "dfw", "nyc", "risk", "penalty", "promotion", "overstock",
        "early bird", "long haul", "what if", "should we", "why", "how much",
        "explain", "recommend", "option", "plan", "savings", "holding",
    ]
    return any(kw in q for kw in keywords)


def _rules_engine(
    question: str,
    scenario: Optional[Scenario],
    optimization_result: Optional[dict],
) -> Optional[str]:
    """Generate a factually correct answer using rules. Returns None for open-ended questions."""

    dc_lookup = _build_dc_lookup(scenario)
    if not dc_lookup:
        return None

    q = question.lower()
    direction = _find_transfer_direction(question)
    target_dc = _find_dc_in_question(question, dc_lookup)
    biggest_shortage = _get_biggest_shortage(dc_lookup)
    biggest_surplus = _get_biggest_surplus(dc_lookup)

    transfers = []
    if optimization_result and "transfers" in optimization_result:
        transfers = optimization_result["transfers"]

    # ─── "Should we ship TO X?" ───
    if direction == "TO" and target_dc:
        if target_dc["surplus"] > 0:
            answer = (
                f"No. {target_dc['name']} ({target_dc['id']}) already has a SURPLUS of "
                f"+{target_dc['surplus']:,} units ({target_dc['stock']:,} stock vs "
                f"{target_dc['demand']:,} demand). It does not need more inventory — "
                f"it is a source of excess stock, not a destination."
            )
            if biggest_shortage:
                answer += (
                    f"\n\nThe real shortage is at {biggest_shortage['name']} "
                    f"({biggest_shortage['id']}), which is short by "
                    f"{abs(biggest_shortage['surplus']):,} units. "
                )
                # Find the recommended transfer to this shortage DC
                for t in transfers:
                    if t["destination"] == biggest_shortage["id"]:
                        answer += (
                            f"The optimizer recommends shipping {t['units']:,} units "
                            f"FROM {t['origin']} TO {t['destination']} at ${t['cost']:,.2f}."
                        )
                        break
            return answer

        elif target_dc["surplus"] < 0:
            answer = (
                f"Yes, {target_dc['name']} ({target_dc['id']}) has a SHORTAGE of "
                f"{abs(target_dc['surplus']):,} units ({target_dc['stock']:,} stock vs "
                f"{target_dc['demand']:,} demand) and needs inbound stock."
            )
            for t in transfers:
                if t["destination"] == target_dc["id"]:
                    answer += (
                        f"\n\nThe optimizer recommends shipping {t['units']:,} units "
                        f"FROM {t['origin']} TO {t['destination']} at ${t['cost']:,.2f}."
                    )
                    break
            return answer

    # ─── "Should we ship FROM X?" / "take stock from X?" ───
    if direction == "FROM" and target_dc:
        if target_dc["surplus"] < 0:
            answer = (
                f"No. {target_dc['name']} ({target_dc['id']}) has a SHORTAGE of "
                f"{abs(target_dc['surplus']):,} units ({target_dc['stock']:,} stock vs "
                f"{target_dc['demand']:,} demand). It cannot afford to send stock away — "
                f"it needs to RECEIVE stock, not send it."
            )
            if biggest_surplus:
                answer += (
                    f"\n\nInstead, consider sourcing from {biggest_surplus['name']} "
                    f"({biggest_surplus['id']}), which has a surplus of "
                    f"+{biggest_surplus['surplus']:,} units."
                )
            return answer

        elif target_dc["surplus"] > 0:
            answer = (
                f"Yes, {target_dc['name']} ({target_dc['id']}) has a SURPLUS of "
                f"+{target_dc['surplus']:,} units ({target_dc['stock']:,} stock vs "
                f"{target_dc['demand']:,} demand) and can send stock."
            )
            for t in transfers:
                if t["origin"] == target_dc["id"]:
                    answer += (
                        f"\n\nThe optimizer recommends shipping {t['units']:,} units "
                        f"FROM {t['origin']} TO {t['destination']} at ${t['cost']:,.2f}."
                    )
                    break
            return answer

    # ─── "Why are we shipping X to Y?" / explain a specific transfer ───
    if any(w in q for w in ["why", "explain", "reason"]) and transfers:
        for t in transfers:
            origin_lower = t["origin"].lower().replace("dc-", "")
            dest_lower = t["destination"].lower().replace("dc-", "")
            if origin_lower in q or dest_lower in q:
                origin_info = dc_lookup.get(t["origin"].lower(), {})
                dest_info = dc_lookup.get(t["destination"].lower(), {})
                answer = (
                    f"The optimizer recommends shipping {t['units']:,} units FROM "
                    f"{t['origin']} TO {t['destination']}.\n\n"
                    f"Why: {t['origin']} has a surplus of +{origin_info.get('surplus', 0):,} units "
                    f"({origin_info.get('stock', 0):,} stock vs {origin_info.get('demand', 0):,} demand), "
                    f"while {t['destination']} has a shortage of {abs(dest_info.get('surplus', 0)):,} units "
                    f"({dest_info.get('stock', 0):,} stock vs {dest_info.get('demand', 0):,} demand).\n\n"
                    f"Cost: ${t['cost']:,.2f} transport, {t['carbon_kg']:.0f} kg CO2."
                )
                if scenario:
                    answer += f"\n\n{scenario.ai_logic}"
                return answer

    # ─── "What's the biggest risk?" / risk questions ───
    if any(w in q for w in ["risk", "danger", "critical", "worried", "concern"]):
        if biggest_shortage:
            answer = (
                f"The biggest risk is at {biggest_shortage['name']} ({biggest_shortage['id']}), "
                f"which has a shortage of {abs(biggest_shortage['surplus']):,} units "
                f"({biggest_shortage['stock']:,} stock vs {biggest_shortage['demand']:,} demand, "
                f"{biggest_shortage['utilization']}% capacity utilization)."
            )
            cb = optimization_result.get("cost_breakdown", {}) if optimization_result else {}
            stockout_penalty = cb.get("stockout_penalty", 0)
            if stockout_penalty > 0:
                answer += f"\n\nIf unaddressed, the stockout penalty is ${stockout_penalty:,.2f}."
            for t in transfers:
                if t["destination"] == biggest_shortage["id"]:
                    answer += (
                        f"\n\nThe optimizer mitigates this by shipping {t['units']:,} units "
                        f"FROM {t['origin']} at ${t['cost']:,.2f}."
                    )
                    break
            return answer

    # ─── "What if we do nothing?" / inaction questions ───
    if any(phrase in q for phrase in ["do nothing", "wait", "don't ship", "no action"]):
        cb = optimization_result.get("cost_breakdown", {}) if optimization_result else {}
        stockout = cb.get("stockout_penalty", 0)
        total = optimization_result.get("objective_value", 0) if optimization_result else 0
        if biggest_shortage:
            answer = (
                f"If we do nothing, {biggest_shortage['name']} faces a shortage of "
                f"{abs(biggest_shortage['surplus']):,} units. "
            )
            if stockout > 0:
                answer += (
                    f"The estimated stockout penalty is ${stockout:,.2f} in lost sales "
                    f"and expedited shipping costs. "
                )
            answer += (
                f"The optimizer's rebalancing plan costs ${total:,.2f} total, "
                f"which is significantly less than the cost of inaction."
            )
            return answer

    # ─── Cost / carbon questions ───
    if any(w in q for w in ["cost", "carbon", "emission", "co2", "savings", "save", "how much"]):
        if optimization_result:
            cb = optimization_result.get("cost_breakdown", {})
            total_carbon = optimization_result.get("total_carbon_kg", 0)
            total = optimization_result.get("objective_value", 0)
            answer = (
                f"Plan costs breakdown:\n"
                f"- Transport: ${cb.get('transport', 0):,.2f}\n"
                f"- Holding: ${cb.get('holding', 0):,.2f}\n"
                f"- Stockout penalty: ${cb.get('stockout_penalty', 0):,.2f}\n"
                f"- Overflow penalty: ${cb.get('overflow_penalty', 0):,.2f}\n"
                f"- Total: ${total:,.2f}\n"
                f"- Carbon footprint: {total_carbon:,.0f} kg CO2"
            )
            return answer

    # Open-ended questions — return None so LLM handles with constrained context
    return None


# ─── Context builder for LLM ───

def _build_facts_context(
    scenario: Optional[Scenario],
    optimization_result: Optional[dict],
) -> str:
    """Build a facts-only context string for the LLM."""
    parts = []

    if scenario:
        parts.append(f"SCENARIO: {scenario.name}")
        parts.append(f"Description: {scenario.description}")
        parts.append(f"Hidden Logic: {scenario.ai_logic}")
        parts.append("")
        parts.append("DC DATA:")
        for dc in scenario.dcs:
            gap = dc.current_stock - dc.demand_forecast
            status = "SURPLUS" if gap > 0 else "SHORTAGE"
            parts.append(
                f"  {dc.name} ({dc.id}): Stock={dc.current_stock}, Demand={dc.demand_forecast}, "
                f"{status} {gap:+d} units"
            )

    if optimization_result and "transfers" in optimization_result:
        parts.append("")
        parts.append("RECOMMENDED TRANSFERS:")
        for t in optimization_result["transfers"]:
            parts.append(
                f"  {t['origin']} --> {t['destination']}: {t['units']} units, "
                f"${t['cost']:,.2f}, {t['carbon_kg']:.0f} kg CO2"
            )
        if "objective_value" in optimization_result:
            parts.append(f"TOTAL COST: ${optimization_result['objective_value']:,.2f}")

    return "\n".join(parts)


# ─── LLM System Prompt (constrained) ───

SYSTEM_PROMPT = """You are a supply chain consultant. You ONLY answer questions about inventory, shipping, distribution centers, and supply chain optimization.

STRICT RULES:
1. ONLY use facts from the VERIFIED ANSWER or DATA provided. Do NOT invent numbers.
2. If a VERIFIED ANSWER is provided, rephrase it naturally but do NOT change any facts, numbers, DC names, or transfer directions.
3. Keep answers to 3-5 sentences maximum.
4. If the question is NOT about supply chain, inventory, shipping, or optimization, respond: "I can only answer questions about supply chain optimization and inventory redeployment decisions."
5. NEVER make up transfer recommendations that are not in the data.
6. Use plain business language, no technical jargon."""


# ─── Main entry point ───

async def explain_decision(
    scenario: Optional[Scenario],
    optimization_result: Optional[dict],
    user_question: str,
    conversation_history: Optional[List[dict]] = None,
    summary: str = "",
    recent_messages: Optional[List[dict]] = None,
) -> str:
    # Guardrail: reject irrelevant questions
    if not _is_supply_chain_question(user_question):
        return (
            "I can only answer questions about supply chain optimization and inventory "
            "redeployment decisions. Please ask about DC inventory levels, transfer "
            "recommendations, costs, risks, or the current optimization scenario."
        )

    # Step 1: Rules engine generates factual answer
    rules_answer = _rules_engine(user_question, scenario, optimization_result)

    if rules_answer:
        # Step 2a: For factual questions, ask LLM to rephrase (not regenerate)
        llm_response = await _rephrase_with_llm(
            user_question, rules_answer, scenario, optimization_result,
            summary, recent_messages or conversation_history,
        )
        return llm_response or rules_answer
    else:
        # Step 2b: For open-ended questions, give LLM the data and let it reason
        llm_response = await _open_ended_with_llm(
            user_question, scenario, optimization_result,
            summary, recent_messages or conversation_history,
        )
        return llm_response or _fallback_response(scenario, optimization_result)


async def _rephrase_with_llm(
    question: str,
    verified_answer: str,
    scenario: Optional[Scenario],
    optimization_result: Optional[dict],
    summary: str = "",
    history: Optional[List[dict]] = None,
) -> Optional[str]:
    """Ask LLM to rephrase the verified answer naturally."""
    endpoint = os.getenv("LLAMA_ENDPOINT", "")
    if not endpoint:
        return None

    prompt = (
        f"The user asked: \"{question}\"\n\n"
        f"VERIFIED ANSWER (all facts here are correct — do NOT change any numbers, "
        f"DC names, or transfer directions):\n{verified_answer}\n\n"
        f"Rephrase this answer in a natural, conversational tone for a supply chain executive. "
        f"Keep it concise (3-5 sentences). Do NOT add any new facts or change any numbers."
    )

    if summary:
        prompt = f"Previous conversation summary: {summary}\n\n{prompt}"

    try:
        return await _call_llama_simple(endpoint, prompt)
    except Exception:
        return None


async def _open_ended_with_llm(
    question: str,
    scenario: Optional[Scenario],
    optimization_result: Optional[dict],
    summary: str = "",
    history: Optional[List[dict]] = None,
) -> Optional[str]:
    """For open-ended questions, give LLM constrained data to reason over."""
    endpoint = os.getenv("LLAMA_ENDPOINT", "")
    if not endpoint:
        return None

    facts = _build_facts_context(scenario, optimization_result)

    prompt = (
        f"Answer this supply chain question using ONLY the data below. "
        f"Do NOT invent any numbers or facts not in the data. "
        f"If you are unsure, say so. Keep your answer to 3-5 sentences.\n\n"
        f"DATA:\n{facts}\n\n"
    )

    if summary:
        prompt += f"Previous conversation summary: {summary}\n\n"

    prompt += f"QUESTION: {question}"

    try:
        response = await _call_llama_simple(endpoint, prompt)
        if response:
            return _validate_response(response, scenario, optimization_result)
        return None
    except Exception:
        return None


def _validate_response(
    response: str,
    scenario: Optional[Scenario],
    optimization_result: Optional[dict],
) -> str:
    """Final guardrail: check for obvious factual errors in LLM output."""
    if not scenario:
        return response

    dc_lookup = _build_dc_lookup(scenario)

    # Check for direction errors
    for dc_name_key, info in dc_lookup.items():
        if len(dc_name_key) < 3:
            continue
        name = info["name"]
        dc_id = info["id"]

        # "ship from [shortage DC]" — wrong
        if info["surplus"] < 0:
            bad_patterns = [f"ship from {name}", f"ship from {dc_id}", f"send from {name}"]
            for pat in bad_patterns:
                if pat.lower() in response.lower():
                    biggest_surplus = _get_biggest_surplus(dc_lookup)
                    if biggest_surplus:
                        response += (
                            f"\n\nCorrection: {name} has a shortage of "
                            f"{abs(info['surplus']):,} units and cannot send stock. "
                            f"Stock should come FROM {biggest_surplus['name']} "
                            f"(+{biggest_surplus['surplus']:,} surplus) TO {name}."
                        )
                    return response

        # "ship to [surplus DC]" — wrong (unless it's a qualified negative)
        if info["surplus"] > 0:
            bad_patterns = [f"ship to {name}", f"send to {name}", f"ship to {dc_id}"]
            for pat in bad_patterns:
                if pat.lower() in response.lower():
                    # Check it's not a negation
                    context_window = response.lower()
                    pat_idx = context_window.find(pat.lower())
                    before = context_window[max(0, pat_idx - 30):pat_idx]
                    if "not " not in before and "no," not in before and "don't" not in before:
                        biggest_shortage = _get_biggest_shortage(dc_lookup)
                        if biggest_shortage:
                            response += (
                                f"\n\nCorrection: {name} already has a surplus of "
                                f"+{info['surplus']:,} units. The shortage is at "
                                f"{biggest_shortage['name']} ({biggest_shortage['surplus']:,} units)."
                            )
                        return response

    return response


# ─── LLM call helpers ───

async def _call_llama_simple(endpoint: str, prompt: str) -> str:
    """Call LLama with a simple text prompt."""
    full_prompt = (
        f"[INST] <<SYS>>\n{SYSTEM_PROMPT}\n<</SYS>> [/INST]\n"
        f"[INST] {prompt} [/INST]"
    )

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            endpoint,
            json={
                "prompt": full_prompt,
                "n_predict": 512,
                "temperature": 0.2,
                "stop": ["[INST]", "[/INST]"],
            },
            headers={"Content-Type": "application/json"},
            timeout=60.0,
        )
        resp.raise_for_status()
        return _clean_response(resp.json().get("content", ""))


def _clean_response(text: str) -> str:
    """Strip LLama prompt template tags from response."""
    text = text.replace("[/INST]", "").replace("[INST]", "")
    text = text.replace("<<SYS>>", "").replace("<</SYS>>", "")
    return text.strip()


async def call_llm(prompt: str) -> str:
    """Simple utility for any agent to call LLama with a plain text prompt."""
    endpoint = os.getenv("LLAMA_ENDPOINT", "")
    if not endpoint:
        return ""
    try:
        return await _call_llama_simple(endpoint, prompt)
    except Exception:
        return ""


# Keep for backward compat with chat endpoint
def _messages_to_prompt(messages: list) -> str:
    parts = []
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        if role == "system":
            parts.append(f"[INST] <<SYS>>\n{content}\n<</SYS>> [/INST]")
        elif role == "user":
            parts.append(f"[INST] {content} [/INST]")
        elif role == "assistant":
            parts.append(content)
    return "\n".join(parts)


async def _call_llama(endpoint: str, messages: list) -> str:
    prompt = _messages_to_prompt(messages)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            endpoint,
            json={"prompt": prompt, "n_predict": 512, "temperature": 0.2, "stop": ["[INST]", "[/INST]"]},
            headers={"Content-Type": "application/json"},
            timeout=60.0,
        )
        resp.raise_for_status()
        return _clean_response(resp.json().get("content", ""))


def _fallback_response(
    scenario: Optional[Scenario],
    optimization_result: Optional[dict],
) -> str:
    if scenario:
        return (
            f"Regarding the {scenario.name} scenario: {scenario.ai_logic}"
        )
    return (
        "The optimizer evaluates all possible inventory movements to minimize total cost "
        "while maintaining service levels. Ask me about specific DCs, transfers, or risks."
    )
