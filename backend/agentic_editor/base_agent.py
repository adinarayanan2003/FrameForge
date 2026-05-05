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
        import google.generativeai as genai
        import os
        
        request = state["request"]
        context = state.get("context")
        history = state.get("conversation_history", [])
        
        # Simple Logic:
        # 1. If analysis requested, look at context summary
        # 2. If general chat, just chat
        
        # Setup model
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-3-flash-preview')
            
            # Extract request context
            req_ctx = request.context or {}
            selected_clip_id = req_ctx.get("selectedClipId")
            selected_clip_ids = req_ctx.get("selectedClipIds", [])
            if selected_clip_id and selected_clip_id not in selected_clip_ids:
                selected_clip_ids.append(selected_clip_id)
            
            playhead = req_ctx.get("playheadPosition", 0)
            
            # Format clip list for LLM
            clips_info = []
            if state["manifest"] and state["manifest"].clips:
                for c in state["manifest"].clips:
                    c_id = c.get("id")
                    start = c.get("timelineStart", 0)
                    end = c.get("timelineEnd", 0)
                    
                    # Check selection
                    is_sel = ""
                    if c_id in selected_clip_ids:
                        is_sel = "(SELECTED)"
                    
                    if c.get("type") == "video":
                        clips_info.append(f"- Clip '{c_id}' {is_sel}: {start:.2f}s - {end:.2f}s (Duration: {end-start:.2f}s)")
            
            clips_str = "\n".join(clips_info[:30]) # Increased limit slightly
            
            # Construct prompt
            system_instruction = """
            You are an expert AI Video Editor.
            You can perform the following actions locally on the timeline:
            
            1. TRIM_CLIP: Trim a clip's SOURCE window.
               - startTime: New source start (seconds in source media)
               - endTime: New source end (seconds in source media)
               - The clip keeps its current timelineStart.
               - Resulting timeline duration = endTime - startTime.
               
               SEMANTIC RULES:
               - "trim out the first X seconds" = REMOVE the first X seconds, keep the rest
                 → If source window is 0-6s and you trim out first 3s, keep source 3-6s
                 → Set startTime=3, endTime=6
               - "trim/cut the last X seconds" = REMOVE the last X seconds
                 → If source window is 0-6s and you trim out last 3s, keep source 0-3s
                 → Set startTime=original_start, endTime=original_end-X
               - "shorten by X seconds" = remove X seconds from the end
               
            2. SPLIT_CLIP: Cut a clip into two at a timeline timestamp.
               Use this for "split here", "cut at playhead".
               Required: {"actionType": "split", "clipId": "...", "startTime": float}
               
            3. DELETE_CLIP: Remove a clip from the timeline.
               Required: {"actionType": "delete", "clipId": "..."}
               
            4. MOVE_PLAYHEAD: Jump to a time on timeline.
               Required: {"actionType": "move_playhead", "startTime": float}

            5. ADD_CAPTION: Add subtitles or text overlay.
               Required: {"actionType": "add_caption", "text": "...", "startTime": float, "endTime": float}
               
            6. ADD_TRANSITION: Add a transition effect BETWEEN two clips.
                The transition duration is SPLIT between both clips (half at end of clip A, half at start of clip B).
                - clipId: The OUTGOING clip (the clip the transition starts from)
                - beforeClipId: (optional) The INCOMING clip. If not provided, will auto-detect the next clip on timeline.
                Valid types: "fade", "dissolve", "wipe", "slide"
                Default duration: 0.5 seconds (0.25s for each clip)
                
                TIP: Suggest adding transitions between clips for a more polished look!
                - "fade" is good for dramatic transitions
                - "dissolve" is smooth for any type of cut
                - "wipe" and "slide" work well for movement
                Example: {"actionType": "add_transition", "clipId": "shot_1", "beforeClipId": "shot_2", "transitionType": "fade", "duration": 0.5}

            CRITICAL: You MUST return a valid JSON object with "reasoning" (string) and "actions" (list).
            
            IMPORTANT: 
            - If user asks to trim with negative time or impossible values, reject with an error in reasoning.
            - Always validate: endTime must be greater than startTime.
            
            Example 1: "trim out the first 3 seconds of clip with source 0-6s"
            - User wants to REMOVE first 3s (keep 3-6s content)
            - { "actionType": "trim", "clipId": "X", "startTime": 3.0, "endTime": 6.0 }
            
            Example 2: "trim out the last 2 seconds of clip at 10-16s"
            - User wants to REMOVE last 2s (keep 10-14s content)  
            - New timeline should be 10-14s
            - { "actionType": "trim", "clipId": "X", "startTime": 10.0, "endTime": 14.0 }
            """
            
            context_str = "No rich context available."
            if context:
                visuals = context.visual_summary if context.visual_summary else "No visual analysis available."
                context_str = f"""
                Visual Analysis:
                {visuals}
                """
                
            # Format history
            history_str = ""
            if history:
                # Filter out the very last user message which is likely the current one (already in request.prompt)
                # But typically session_store adds it before calling this.
                # Let's just include the last few turns
                recent = history[-10:] 
                history_lines = []
                for msg in recent:
                    role = msg.get("role", "unknown").upper()
                    content = msg.get("content", "")
                    history_lines.append(f"{role}: {content}")
                history_str = "\n".join(history_lines)

            prompt = f"""
            {system_instruction}
            
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
            
            TIP: Consider adding transitions (fade/dissolve/wipe/slide) between clips for a more professional look!
            
            Return JSON only.
            """
            
            try:
                # Force JSON response
                response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
                
                import json
                parsed = json.loads(response.text)
                
                # Convert raw dicts to AgentAction models
                actions = []
                for act in parsed.get("actions", []):
                    # Ensure compatibility with Pydantic model
                    # The LLM might output snake_case or camelCase, we need to be careful.
                    # Our AgentAction expects camelCase 'actionType'.
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
                logger.error(f"LLM generation failed: {e}")
                return {
                    "reasoning": f"I tried to process that but failed: {str(e)}",
                    "actions": []
                }
        
        return {
            "reasoning": "I am the Base Agent. I see you, but I have no brain (LLM not configured).",
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
