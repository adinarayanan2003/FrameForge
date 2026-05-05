import os
import asyncio
import logging
import traceback
from functools import wraps

import nest_asyncio
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from agentic_editor.agents import CaptionAgent, CleanupAgent
from agentic_editor.base_agent import BaseAgent
from agentic_editor.context.asset_fetcher import AssetFetcher
from agentic_editor.context.manifest_context import ManifestContextBuilder
from agentic_editor.context.session_store import session_store
from agentic_editor.reasoning.intent_router import IntentRouter
from agentic_editor.types import AgentRequest, AgentStatus

nest_asyncio.apply()
load_dotenv()

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)


def require_api_key(handler):
    @wraps(handler)
    def decorated(*args, **kwargs):
        accepted = {key for key in (os.getenv("API_KEY"), os.getenv("AGENT_API_KEY")) if key}
        if not accepted:
            return handler(*args, **kwargs)

        provided = request.headers.get("X-API-Key") or request.headers.get("Authorization", "").replace("Bearer ", "")
        if provided not in accepted:
            return jsonify({"error": "Unauthorized", "message": "Valid API key required"}), 401

        return handler(*args, **kwargs)

    return decorated


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def create_app():
    app = Flask(__name__)
    CORS(app)

    @app.get("/health")
    def health():
        return jsonify({"ok": True, "service": "owly-agent"})

    @app.post("/api/agent/interact")
    @require_api_key
    def interact_with_agent():
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No JSON data provided"}), 400

            try:
                agent_req = AgentRequest(**data)
            except Exception as exc:
                return jsonify({"error": f"Invalid request format: {exc}"}), 400

            asset_fetcher = AssetFetcher()
            context_builder = ManifestContextBuilder(asset_fetcher)
            manifest_context = _run(context_builder.build(agent_req.manifest))

            job_id = agent_req.manifest.jobId or agent_req.manifest.job_id or "default_session"
            session_store.add_message(job_id, "user", agent_req.prompt)
            history = session_store.get_history(job_id)

            selected_type = None
            selected_ids = []
            if agent_req.context:
                selected_ids = agent_req.context.get("selectedClipIds", [])
                if agent_req.context.get("selectedClipId") and agent_req.context.get("selectedClipId") not in selected_ids:
                    selected_ids.append(agent_req.context.get("selectedClipId"))

            if selected_ids and agent_req.manifest.clips:
                for clip in agent_req.manifest.clips:
                    if clip.get("id") == selected_ids[0]:
                        selected_type = clip.get("type")
                        break

            selection_context = {
                "selectedClipId": selected_ids[0] if selected_ids else None,
                "selectedClipIds": selected_ids,
                "selectedClipType": selected_type,
                "playheadPosition": (agent_req.context or {}).get("playheadPosition", 0),
            }

            router = IntentRouter()
            agent_id = _run(router.route(agent_req.prompt, manifest_context, history=history, selection_context=selection_context))
            logger.info("Routed agent request to %s", agent_id)

            if agent_id == "cleanup":
                agent = CleanupAgent(agent_id)
            elif agent_id == "caption":
                agent = CaptionAgent(agent_id)
            else:
                agent = BaseAgent("general")

            response = _run(agent.process_request(agent_req, history=history))
            response.status = AgentStatus.READY
            response.status_message = "Ready"
            session_store.add_message(job_id, "assistant", response.reasoning)
            return jsonify(response.model_dump(mode="json")), 200
        except Exception as exc:
            logger.error("Agent interaction failed: %s", traceback.format_exc())
            return jsonify({"error": str(exc), "status": AgentStatus.ERROR.value}), 500

    @app.get("/api/agent/history")
    @require_api_key
    def get_history():
        job_id = request.args.get("job_id")
        if not job_id:
            return jsonify({"error": "Missing job_id parameter"}), 400
        return jsonify({"history": session_store.get_history(job_id)})

    @app.delete("/api/agent/history")
    @require_api_key
    def clear_history():
        job_id = request.args.get("job_id")
        if not job_id:
            return jsonify({"error": "Missing job_id parameter"}), 400
        session_store.clear_session(job_id)
        return jsonify({"success": True, "job_id": job_id})

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5001"))
    app.run(host="127.0.0.1", port=port, debug=os.getenv("FLASK_DEBUG") == "1")
