from typing import List, Tuple
from agentic_editor.types import AgentAction, AgentActionType

def compute_remove_ranges_actions(
    ranges: List[Tuple[float, float]], 
    clip_id: str,
    reason_prefix: str = "Silence detected"
) -> List[AgentAction]:
    """
    Generate REMOVE_RANGE actions for a list of (start, end) tuples.
    """
    actions = []
    for start, end in ranges:
        # Check against min duration? Handled by detector usually.
        actions.append(AgentAction(
            actionType=AgentActionType.REMOVE_RANGE.value,
            clipId=clip_id,
            startTime=start,
            endTime=end,
            reasoning=f"{reason_prefix} ({start:.2f}s - {end:.2f}s)"
        ))
    return actions
