import logging
import os
import google.generativeai as genai
from typing import List, Dict, Optional, Any
from agentic_editor.context.manifest_context import ManifestContext

logger = logging.getLogger(__name__)

# Configure API key
api_key = os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)


class IntentRouter:
    """
    Routes user prompts to the appropriate specialized agent using Gemini 3 Flash.
    Now enhanced with contextual awareness (timeline selection).
    """
    def __init__(self, model_name: str = "gemini-3-flash-preview"):
        self.model_name = model_name
        self._model = None

    def _get_model(self):
        if self._model is None:
            try:
                self._model = genai.GenerativeModel(self.model_name)
            except Exception:
                logger.warning(f"Model {self.model_name} not found, falling back to gemini-3-flash-preview")
                self._model = genai.GenerativeModel("gemini-3-flash-preview")
        return self._model

    async def route(
        self, 
        prompt: str, 
        context: ManifestContext, 
        history: List[Dict] = [],
        selection_context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Determine which agent should handle the request.
        Returns agent_id string: 'cleanup', 'caption', 'broll', 'director', 'general'.
        
        Args:
            prompt: User's input prompt
            context: ManifestContext with video metadata
            history: Conversation history
            selection_context: Timeline selection info containing:
                - selectedClipId: Currently selected clip ID
                - selectedClipIds: List of selected clip IDs
                - selectedClipTypes: Types of selected clips (e.g., 'video', 'audio', 'text')
                - playheadPosition: Current playhead time
        """
        model = self._get_model()
        
        # Build selection context string
        selection_info = ""
        if selection_context:
            selected_ids = selection_context.get("selectedClipIds", [])
            selected_type = selection_context.get("selectedClipType")  # e.g., 'video', 'text', 'audio'
            playhead = selection_context.get("playheadPosition", 0)
            
            # Get clip details from context
            clip_details = []
            if context and hasattr(context, 'timeline_summary'):
                # Parse timeline summary for clip info
                summary = context.timeline_summary or ""
            
            selection_info = f"""
TIMELINE SELECTION CONTEXT:
- Currently Selected Clip IDs: {selected_ids}
- Selected Clip Type: {selected_type or 'none'}
- Playhead Position: {playhead}s

IMPORTANT: Use this context to help route the request:
- If user says "make it red" or "change color" and a TEXT/CAPTION is selected → route to 'caption'
- If user says "speed up" and VIDEO is selected → route to 'general' or adjust via base agent
- If user says "add music" and nothing selected → route to 'general'
"""
        
        system_prompt = f"""
        You are the Intent Router for an AI Video Editor.
        Your job is to classify the user's request into one of the following agents:

        1. 'cleanup': Requests to remove silence, filler words, noise, or clean up audio.
        2. 'caption': Requests to add subtitles, captions, text overlays, style captions, or "Hormozi style" text.
        3. 'broll': Requests to add b-roll, stock footage, or images to cover talking heads.
        4. 'director': High-level creative requests like "make it punchier", "create a teaser", "re-edit for tiktok".
        5. 'general': Simple questions or requests that don't fit specific agents (or handled by base agent).

        {selection_info}

        Analyze the user prompt, the current video context, and any timeline selection.
        Return ONLY the agent_id string.
        """
        
        # Format recent history for context (last 3 turns)
        history_text = ""
        if history:
            recent = history[-6:] # Last 6 messages (3 turns)
            history_text = "\nRecent Conversation:\n" + "\n".join([f"{m['role'].upper()}: {m['content']}" for m in recent])

        user_message = f"""
        Context Summary: {context.timeline_summary if context else 'No timeline context'}
        {history_text}
        
        Current User Prompt: "{prompt}"
        
        CRITICAL INSTRUCTIONS:
        1. If the user is asking a QUESTION about what was just done (e.g. "what captions?", "why did you do that?"), return 'general'.
        2. If the user wants to PERFORM an action (e.g. "add captions", "remove silence"), return the specific agent.
        3. If the request is about STYLE (e.g. "make it pop", "change to hormozi"), return the agent that likely created the content (e.g. 'caption') or 'director'.
        4. CONTEXT AWARE: If user refers to "it", "this", "make it X" and something is selected, consider what's selected.
           - Text/caption selected + "make it red" → 'caption'
           - Video selected + "speed up" → 'general'
        
        Which agent should handle this?
        """

        try:
            response = model.generate_content([system_prompt, user_message])
            agent_id = response.text.strip().lower()
            
            # Smart Overrides: If LLM is conservative and says "general", check for strong signals
            if agent_id == "general":
                p = prompt.lower()
                if "caption" in p or "subtitle" in p or "text" in p or "hormozi" in p:
                    return "caption"
                if "clean" in p or "silence" in p or "remove" in p:
                    return "cleanup"
                if "b-roll" in p or "stock" in p:
                    return "broll"

            # reliable fallback cleaning
            valid_agents = {"cleanup", "caption", "broll", "director", "general"}
            if agent_id not in valid_agents:
                # Fallback heuristics if LLM hallucinates
                if "clean" in agent_id or "silence" in agent_id: return "cleanup"
                if "caption" in agent_id or "text" in agent_id: return "caption"
                if "b-roll" in agent_id or "stock" in agent_id: return "broll"
                return "general"
                
            return agent_id

        except Exception as e:
            logger.error(f"Intent routing failed: {e}")
            # Fallback to simple keyword matching
            p = prompt.lower()
            if "silence" in p or "clean" in p: return "cleanup"
            if "caption" in p or "subtitle" in p or "hormozi" in p: return "caption"
            return "general"
