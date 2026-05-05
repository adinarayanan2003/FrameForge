from typing import List, Dict, Any, Optional
import time

class SessionStore:
    """
    In-memory store for managing multi-turn conversation history.
    Keyed by job_id.
    """
    def __init__(self):
        # Format: { job_id: [ { role: "user", content: "..." }, ... ] }
        self._sessions: Dict[str, List[Dict[str, Any]]] = {}
        
    def get_history(self, job_id: str) -> List[Dict[str, Any]]:
        """Retrieve conversation history for a job."""
        return self._sessions.get(job_id, [])

    def add_message(self, job_id: str, role: str, content: str):
        """Add a message to the session history."""
        if job_id not in self._sessions:
            self._sessions[job_id] = []
            
        self._sessions[job_id].append({
            "role": role,
            "content": content,
            "timestamp": time.time()
        })
        
    def clear_session(self, job_id: str):
        """Clear history for a job."""
        if job_id in self._sessions:
            del self._sessions[job_id]

# Global singleton instance
session_store = SessionStore()
