from typing import Dict, Any, List, TypedDict, Annotated, Optional
import operator
import logging
from langgraph.graph import StateGraph, END
from agentic_editor.types import AgentRequest, AgentResponse, AgentAction, EditManifest, AgentStatus
from agentic_editor.context.manifest_context import ManifestContext, ManifestContextBuilder
from agentic_editor.context.session_store import session_store
from agentic_editor.context.asset_fetcher import AssetFetcher
from agentic_editor.perception.visual_eye import VisualEye
from agentic_editor.tools.validator import validator, ValidationResult
from agentic_editor.llm import openai_text_response

logger = logging.getLogger(__name__)

class AgentState(TypedDict):
    request: AgentRequest
    manifest: EditManifest
    context: Optional[ManifestContext]  # Rich context (assets, summary)
    conversation_history: List[Dict[str, Any]]  # Multi-turn history
    actions: Annotated[List[AgentAction], operator.add]
    reasoning: str
    scratchpad: Dict[str, Any]

class BaseAgent:
    """
    Base class for Agentic Editor agents using LangGraph.
    Now enhanced with Context, Perception, and Memory.
    """
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.workflow = self._build_workflow()
        
        # Initialize context tools
        # In a real app, these might be injected or singletons
        self.asset_fetcher = AssetFetcher()
        self.context_builder = ManifestContextBuilder(self.asset_fetcher)
        self.visual_eye = VisualEye()

    def _build_workflow(self) -> StateGraph:
        """
        Builds the LangGraph workflow: perceive -> plan -> execute
        """
        workflow = StateGraph(AgentState)
        
        # Define nodes
        workflow.add_node("perceive", self.perceive_node)
        workflow.add_node("plan", self.plan_node)
        workflow.add_node("execute", self.execute_node)
        
        # Define edges
        workflow.set_entry_point("perceive")
        workflow.add_edge("perceive", "plan")
        workflow.add_edge("plan", "execute")
        workflow.add_edge("execute", END)
        
        return workflow.compile()

    async def perceive_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Gather context and 'sense' the media.
        Builds the ManifestContext if not present.
        """
        # If context is already built (e.g. by router), reuse it.
        # Otherwise build it now.
        ctx = state.get("context")
        if not ctx:
            logger.info(f"[{self.agent_id}] Building manifest context...")
            ctx = await self.context_builder.build(state["manifest"])
            
            # Ensure critical assets are local (e.g. for audio analysis)
            await self.context_builder.ensure_assets_local(ctx)
        
        # ACTIVE PERCEPTION: If user asks to analyze/see, runs VisualEye
        prompt_lower = state["request"].prompt.lower()
        needs_vision = any(w in prompt_lower for w in ["analyze", "describe", "see", "look", "what is", "visual"])
        
        if needs_vision and ctx.source_video_local_path and not ctx.visual_summary:
            logger.info(f"[{self.agent_id}] Active Perception: Analyzing video frames...")
            duration = ctx.total_duration
            # Sample 3 frames: start, middle, end (avoiding exact 0 or end)
            timestamps = [duration * 0.1, duration * 0.5, duration * 0.9]
            timestamps = [t for t in timestamps if t < duration]
            
            if timestamps:
                try:
                    analysis_results = await self.visual_eye.analyze_frames(
                        ctx.source_video_local_path, 
                        timestamps
                    )
                    # Summarize results
                    summary_lines = []
                    for res in analysis_results:
                         summary_lines.append(f"At {res.timestamp:.1f}s: {res.description} (Scene: {res.scene_type})")
                    ctx.visual_summary = "\n".join(summary_lines)
                    logger.info(f"[{self.agent_id}] Visual analysis complete: {len(analysis_results)} frames.")
                except Exception as e:
                    logger.error(f"VisualEye failed: {e}")
                    ctx.visual_summary = "Visual analysis failed."

        return {"context": ctx}

    async def plan_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Analyze request and context to determine actions.
        For BaseAgent (general), we chat with the user based on the context.
        """
        request = state["request"]
        context = state.get("context")
        history = state.get("conversation_history", [])
        
        # Simple Logic:
        # 1. If analysis requested, look at context summary
        # 2. If general chat, just chat
        
        req_ctx = request.context or {}
        selected_clip_id = req_ctx.get("selectedClipId")
        selected_clip_ids = req_ctx.get("selectedClipIds", [])
        if selected_clip_id and selected_clip_id not in selected_clip_ids:
            selected_clip_ids.append(selected_clip_id)

        playhead = req_ctx.get("playheadPosition", 0)

        clips_info = []
        if state["manifest"] and state["manifest"].clips:
            for c in state["manifest"].clips:
                c_id = c.get("id")
                start = c.get("timelineStart", 0)
                end = c.get("timelineEnd", 0)
                is_sel = "(SELECTED)" if c_id in selected_clip_ids else ""
                if c.get("type") == "video":
                    clips_info.append(f"- Clip '{c_id}' {is_sel}: {start:.2f}s - {end:.2f}s (Duration: {end-start:.2f}s)")

        clips_str = "\n".join(clips_info[:30])

        system_instruction = """
        You are an expert AI Video Editor.
        Return a valid JSON object with "reasoning" (string) and "actions" (list).
        Supported action objects:
        - {"actionType": "trim", "clipId": "...", "startTime": float, "endTime": float}
        - {"actionType": "split", "clipId": "...", "startTime": float}
        - {"actionType": "delete", "clipId": "..."}
        - {"actionType": "move_playhead", "startTime": float}
        - {"actionType": "add_caption", "text": "...", "startTime": float, "endTime": float}
        - {"actionType": "add_transition", "clipId": "...", "beforeClipId": "...", "transitionType": "fade|dissolve|wipe|slide", "duration": float}

        For trim requests, startTime/endTime describe the source window to keep.
        If values are impossible, return no actions and explain the issue in reasoning.
        Return JSON only, with no markdown.
        """

        context_str = "No rich context available."
        if context:
            visuals = context.visual_summary if context.visual_summary else "No visual analysis available."
            context_str = f"Visual Analysis:\n{visuals}"

        history_str = ""
        if history:
            recent = history[-10:]
            history_str = "\n".join([
                f"{msg.get('role', 'unknown').upper()}: {msg.get('content', '')}"
                for msg in recent
            ])

        prompt = f"""
        CURRENT STATE:
        - Playhead Position: {playhead}s
        - Selected Clip: {selected_clip_id or "None"}
        - Clips on Timeline:
        {clips_str}

        RICH CONTEXT:
        {context_str}

        CONVERSATION HISTORY:
        {history_str}

        USER PROMPT: "{request.prompt}"
        """

        response_text = openai_text_response(prompt, instructions=system_instruction)
        if response_text is None:
            return {
                "reasoning": "I am the Base Agent. I see you, but I have no brain (OpenAI API key not configured).",
                "actions": []
            }

        try:
            import json
            import re

            cleaned = response_text.strip()
            fence_match = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL)
            if fence_match:
                cleaned = fence_match.group(1).strip()

            parsed = json.loads(cleaned)
            actions = []
            for act in parsed.get("actions", []):
                if "action_type" in act: act["actionType"] = act.pop("action_type")
                if "clip_id" in act: act["clipId"] = act.pop("clip_id")
                if "start_time" in act: act["startTime"] = act.pop("start_time")
                if "end_time" in act: act["endTime"] = act.pop("end_time")

                try:
                    actions.append(AgentAction(**act))
                except Exception as e:
                    logger.warning(f"Failed to parse action {act}: {e}")

            return {
                "reasoning": parsed.get("reasoning", "Processed request."),
                "actions": actions
            }
        except Exception as e:
            logger.error(f"OpenAI response parsing failed: {e}")
            return {
                "reasoning": f"I tried to process that but failed to parse the model response: {str(e)}",
                "actions": []
            }
    async def execute_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Validate actions before returning.
        """
        actions = state.get("actions", [])
        
        if not actions:
            # Must return at least one state field update for LangGraph
            return {"reasoning": state.get("reasoning", "")}
        
        # Get manifest as dict for validation
        manifest_dict = {}
        if state.get("manifest"):
            manifest_dict = state["manifest"].model_dump() if hasattr(state["manifest"], 'model_dump') else state["manifest"]
        
        # Get total duration from context if available
        context = state.get("context")
        total_duration = context.total_duration if context else 30.0  # Default fallback
        
        # Validate actions
        validation_result = validator.validate_actions(
            actions=[a.model_dump() if hasattr(a, 'model_dump') else a for a in actions],
            manifest=manifest_dict,
            total_duration=total_duration
        )
        
        if not validation_result.passed:
            logger.warning(f"Validation failed: {validation_result.errors}")
            # Add validation warnings to reasoning
            error_messages = [f"- {e.message}" for e in validation_result.errors]
            state["reasoning"] += f"\n\n⚠️ **Validation Warnings:**\n" + "\n".join(error_messages)
        
        # Log warnings even if passed
        if validation_result.warnings:
            warning_messages = [f"- {w.message}" for w in validation_result.warnings]
            logger.info(f"Validation warnings: {warning_messages}")
        
        return {"validation": validation_result.model_dump()}

    async def process_request(self, request: AgentRequest, history: List[Dict[str, Any]] = []) -> AgentResponse:
        """
        Main entry point to run the agent.
        """
        initial_state = AgentState(
            request=request,
            manifest=request.manifest,
            context=None, # Will be built in perceive_node
            conversation_history=history,
            actions=[],
            reasoning="",
            scratchpad={}
        )
        
        final_state = await self.workflow.ainvoke(initial_state)
        
        # Get validation result if present
        validation = final_state.get("validation")
        
        return AgentResponse(
            agent_id=self.agent_id,
            actions=final_state["actions"],
            reasoning=final_state["reasoning"],
            status=AgentStatus.READY,
            status_message="Completed" if not validation or validation.get("passed") else "Completed with warnings"
        )
