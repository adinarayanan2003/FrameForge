from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)


class ValidationIssue(BaseModel):
    severity: str  # "error", "warning"
    message: str
    action_index: Optional[int] = None
    field: Optional[str] = None


class ValidationResult(BaseModel):
    passed: bool
    issues: List[ValidationIssue]
    warnings: List[ValidationIssue] = []

    @property
    def errors(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == "error"]


class ActionValidator:
    """
    Validates agent actions against the current timeline state.
    Checks for timeline consistency, bounds, and logical issues.
    """

    def __init__(self):
        self.min_clip_duration = 0.1  # Minimum 100ms for any clip
        self.max_gap_threshold = 0.05  # Warn if gap > 50ms

    def validate_actions(
        self,
        actions: List[Dict[str, Any]],
        manifest: Dict[str, Any],
        total_duration: float
    ) -> ValidationResult:
        """
        Main validation entry point.
        """
        issues: List[ValidationIssue] = []
        warnings: List[ValidationIssue] = []

        clips = manifest.get("clips", [])
        clip_map = {c.get("id"): c for c in clips if c.get("id")}

        # 1. Validate each action
        for idx, action in enumerate(actions):
            action_issues = self._validate_single_action(action, clip_map, total_duration, idx)
            issues.extend(action_issues)

        # 2. Check for timeline gaps/overlaps after proposed changes
        timeline_issues = self._validate_timeline_consistency(actions, clips, total_duration)
        issues.extend(timeline_issues)

        # 3. Check for conflicting actions (e.g., delete then trim same clip)
        conflict_issues = self._check_action_conflicts(actions)
        issues.extend(conflict_issues)

        passed = not any(i.severity == "error" for i in issues)

        return ValidationResult(
            passed=passed,
            issues=issues,
            warnings=warnings
        )

    def _validate_single_action(
        self,
        action: Dict[str, Any],
        clip_map: Dict[str, Any],
        total_duration: float,
        action_index: int
    ) -> List[ValidationIssue]:
        """Validate a single action."""
        issues = []
        action_type = action.get("actionType", action.get("actionType"))

        # TRIM action validation
        if action_type in ("trim", "trim_clip"):
            clip_id = action.get("clipId")
            start_time = action.get("startTime")
            end_time = action.get("endTime")

            if not clip_id:
                issues.append(ValidationIssue(
                    severity="error",
                    message="Trim action missing clipId",
                    action_index=action_index,
                    field="clipId"
                ))
                return issues

            clip = clip_map.get(clip_id)
            if not clip:
                issues.append(ValidationIssue(
                    severity="error",
                    message=f"Clip '{clip_id}' not found in timeline",
                    action_index=action_index,
                    field="clipId"
                ))
                return issues

            # Check bounds
            if start_time is not None and start_time < 0:
                issues.append(ValidationIssue(
                    severity="error",
                    message=f"Trim start time cannot be negative: {start_time}",
                    action_index=action_index,
                    field="startTime"
                ))

            if end_time is not None and start_time is not None:
                if end_time <= start_time:
                    issues.append(ValidationIssue(
                        severity="error",
                        message=f"Trim end time must be greater than start time",
                        action_index=action_index,
                        field="endTime"
                    ))

            # Check against original clip duration
            original_start = clip.get("timelineStart", 0)
            original_end = clip.get("timelineEnd", 0)
            original_duration = original_end - original_start

            if end_time is not None and start_time is not None:
                new_duration = end_time - start_time
                if new_duration < self.min_clip_duration:
                    issues.append(ValidationIssue(
                        severity="error",
                        message=f"Resulting clip duration ({new_duration:.2f}s) is too short (min {self.min_clip_duration}s)",
                        action_index=action_index
                    ))

        # SPLIT action validation
        elif action_type == "split":
            clip_id = action.get("clipId")
            split_time = action.get("startTime")

            if not clip_id:
                issues.append(ValidationIssue(
                    severity="error",
                    message="Split action missing clipId",
                    action_index=action_index,
                    field="clipId"
                ))

            clip = clip_map.get(clip_id)
            if clip:
                original_start = clip.get("timelineStart", 0)
                original_end = clip.get("timelineEnd", 0)
                
                if split_time is not None:
                    if split_time <= original_start or split_time >= original_end:
                        issues.append(ValidationIssue(
                            severity="error",
                            message=f"Split time {split_time}s is outside clip range [{original_start}, {original_end}]",
                            action_index=action_index,
                            field="startTime"
                        ))

        # DELETE action validation
        elif action_type in ("delete", "delete_clip"):
            clip_id = action.get("clipId")
            if not clip_id:
                issues.append(ValidationIssue(
                    severity="error",
                    message="Delete action missing clipId",
                    action_index=action_index,
                    field="clipId"
                ))
            elif clip_id not in clip_map:
                issues.append(ValidationIssue(
                    severity="error",
                    message=f"Cannot delete clip '{clip_id}' - not found in timeline",
                    action_index=action_index,
                    field="clipId"
                ))

        # ADD_CAPTION validation
        elif action_type == "add_caption":
            caption_text = action.get("text", "")
            start_time = action.get("startTime")
            end_time = action.get("endTime")

            if not caption_text or not caption_text.strip():
                issues.append(ValidationIssue(
                    severity="error",
                    message="Caption text cannot be empty",
                    action_index=action_index,
                    field="text"
                ))

            if start_time is None or end_time is None:
                issues.append(ValidationIssue(
                    severity="error",
                    message="Caption must have startTime and endTime",
                    action_index=action_index
                ))
            elif end_time <= start_time:
                issues.append(ValidationIssue(
                    severity="error",
                    message="Caption endTime must be greater than startTime",
                    action_index=action_index,
                    field="endTime"
                ))
            elif start_time < 0 or end_time > total_duration:
                issues.append(ValidationIssue(
                    severity="error",
                    message=f"Caption times [{start_time}, {end_time}] outside video duration ({total_duration}s)",
                    action_index=action_index
                ))

        # REMOVE_RANGE validation
        elif action_type == "remove_range":
            start_time = action.get("startTime")
            end_time = action.get("endTime")

            if start_time is None or end_time is None:
                issues.append(ValidationIssue(
                    severity="error",
                    message="Remove range must have startTime and endTime",
                    action_index=action_index
                ))
            elif end_time <= start_time:
                issues.append(ValidationIssue(
                    severity="error",
                    message="Remove range endTime must be greater than startTime",
                    action_index=action_index,
                    field="endTime"
                ))
            elif start_time < 0 or end_time > total_duration:
                issues.append(ValidationIssue(
                    severity="warning",
                    message=f"Remove range extends beyond video bounds",
                    action_index=action_index
                ))

        # MOVE_PLAYHEAD validation
        elif action_type == "move_playhead":
            position = action.get("startTime")
            if position is None:
                issues.append(ValidationIssue(
                    severity="error",
                    message="Move playhead requires startTime",
                    action_index=action_index,
                    field="startTime"
                ))
            elif position < 0 or position > total_duration:
                issues.append(ValidationIssue(
                    severity="warning",
                    message=f"Playhead position {position}s outside video duration",
                    action_index=action_index,
                    field="startTime"
                ))

        # ADD_TRANSITION validation
        elif action_type == "add_transition":
            after_clip_id = action.get("clipId")
            before_clip_id = action.get("beforeClipId")
            transition_type = action.get("transitionType")
            duration = action.get("duration", 0.5)
            
            if not after_clip_id:
                issues.append(ValidationIssue(
                    severity="error",
                    message="Transition requires clipId (afterClipId)",
                    action_index=action_index,
                    field="clipId"
                ))
            
            # Validate transition type
            valid_types = {"fade", "dissolve", "wipe", "slide"}
            if transition_type and transition_type not in valid_types:
                issues.append(ValidationIssue(
                    severity="error",
                    message=f"Invalid transition type '{transition_type}'. Valid: {valid_types}",
                    action_index=action_index,
                    field="transitionType"
                ))
            
            # Validate duration
            if duration <= 0:
                issues.append(ValidationIssue(
                    severity="error",
                    message="Transition duration must be positive",
                    action_index=action_index,
                    field="duration"
                ))
            elif duration > 3:
                issues.append(ValidationIssue(
                    severity="warning",
                    message=f"Transition duration {duration}s is very long (recommended < 2s)",
                    action_index=action_index,
                    field="duration"
                ))
            
            # Check that both clips exist and are adjacent
            if after_clip_id and before_clip_id:
                after_clip = clip_map.get(after_clip_id)
                before_clip = clip_map.get(before_clip_id)
                
                if after_clip and before_clip:
                    # Check adjacency
                    if abs(after_clip.get("timelineEnd", 0) - before_clip.get("timelineStart", 0)) > 0.1:
                        issues.append(ValidationIssue(
                            severity="warning",
                            message=f"Clips '{after_clip_id}' and '{before_clip_id}' are not adjacent on timeline",
                            action_index=action_index
                        ))
                    
                    # Check that half duration fits in each clip
                    half_duration = duration / 2
                    after_duration = after_clip.get("timelineEnd", 0) - after_clip.get("timelineStart", 0)
                    before_duration = before_clip.get("timelineEnd", 0) - before_clip.get("timelineStart", 0)
                    
                    if half_duration > after_duration:
                        issues.append(ValidationIssue(
                            severity="error",
                            message=f"Transition half-duration ({half_duration}s) exceeds outgoing clip duration ({after_duration}s)",
                            action_index=action_index
                        ))
                    
                    if half_duration > before_duration:
                        issues.append(ValidationIssue(
                            severity="error",
                            message=f"Transition half-duration ({half_duration}s) exceeds incoming clip duration ({before_duration}s)",
                            action_index=action_index
                        ))

        return issues

    def _validate_timeline_consistency(
        self,
        actions: List[Dict[str, Any]],
        clips: List[Dict[str, Any]],
        total_duration: float
    ) -> List[ValidationIssue]:
        """Check for timeline gaps and overlaps after proposed changes."""
        issues = []

        # Build expected timeline after actions
        affected_clips = {}
        for action in actions:
            clip_id = action.get("clipId")
            if clip_id:
                if clip_id not in affected_clips:
                    affected_clips[clip_id] = {"original": None, "new_start": None, "new_end": None}
                
                # Find original
                if affected_clips[clip_id]["original"] is None:
                    for c in clips:
                        if c.get("id") == clip_id:
                            affected_clips[clip_id]["original"] = {
                                "start": c.get("timelineStart", 0),
                                "end": c.get("timelineEnd", 0)
                            }
                            break

                # Apply trim
                if action.get("actionType") in ("trim", "trim_clip"):
                    if action.get("startTime") is not None:
                        affected_clips[clip_id]["new_start"] = action["startTime"]
                    if action.get("endTime") is not None:
                        affected_clips[clip_id]["new_end"] = action["endTime"]

        # Check for gaps (simplified)
        # This is a basic check - more complex logic would be needed for full implementation
        for clip_id, data in affected_clips.items():
            original = data.get("original")
            if not original:
                continue
            
            new_start = data.get("new_start", original["start"])
            new_end = data.get("new_end", original["end"])
            
            if new_end < new_start:
                issues.append(ValidationIssue(
                    severity="error",
                    message=f"Trim on clip '{clip_id}' results in invalid duration (end < start)",
                    action_index=None
                ))

        return issues

    def _check_action_conflicts(self, actions: List[Dict[str, Any]]) -> List[ValidationIssue]:
        """Check for conflicting actions on the same clip."""
        issues = []

        clip_actions: Dict[str, List[Dict[str, Any]]] = {}
        
        for idx, action in enumerate(actions):
            clip_id = action.get("clipId")
            if clip_id:
                if clip_id not in clip_actions:
                    clip_actions[clip_id] = []
                clip_actions[clip_id].append({"action": action, "index": idx})

        # Check for DELETE + any other action on same clip
        for clip_id, action_list in clip_actions.items():
            has_delete = any(a["action"].get("actionType") in ("delete", "delete_clip") for a in action_list)
            has_other = any(a["action"].get("actionType") not in ("delete", "delete_clip") for a in action_list)
            
            if has_delete and has_other:
                # Find the non-delete action
                for a in action_list:
                    if a["action"].get("actionType") not in ("delete", "delete_clip"):
                        issues.append(ValidationIssue(
                            severity="warning",
                            message=f"Action on clip '{clip_id}' after it's been deleted will have no effect",
                            action_index=a["index"]
                        ))

        return issues


# Singleton instance
validator = ActionValidator()
