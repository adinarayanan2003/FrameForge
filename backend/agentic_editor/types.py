from typing import List, Optional, Any, Dict
from enum import Enum
from pydantic import BaseModel, ConfigDict


class AgentStatus(str, Enum):
    IDLE = "idle"
    ROUTING = "routing"
    CONTEXT_BUILDING = "context_building"
    PERCEIVING = "perceiving"
    PLANNING = "planning"
    VALIDATING = "validating"
    READY = "ready"
    ERROR = "error"


class AgentStatusUpdate(BaseModel):
    status: AgentStatus
    message: Optional[str] = None
    progress: Optional[float] = None  # 0-100


class AgentActionType(str, Enum):
    CUT_CLIP = "cut_clip" # Legacy?
    TRIM_CLIP = "trim"
    SPLIT_CLIP = "split"
    DELETE_CLIP = "delete"
    REMOVE_RANGE = "remove_range"
    ADD_CLIP = "add_clip"
    ADD_CAPTION = "add_caption" 
    ADD_OVERLAY = "add_overlay"
    ADD_TEXT = "text_overlay" # Legacy?
    REORDER_CLIPS = "reorder_clips"
    CHANGE_SPEED = "change_speed"
    ADD_EFFECT = "add_effect"
    MODIFY_AUDIO = "modify_audio"
    MOVE_PLAYHEAD = "move_playhead"
    ADD_TRANSITION = "add_transition"

class AgentAction(BaseModel):
    """
    Represents a single action the agent wants to perform.
    Uses camelCase field names to match the frontend protocol.
    """
    model_config = ConfigDict(populate_by_name=True)

    actionType: str  # One of AgentActionType values
    clipId: Optional[str] = None
    trackId: Optional[str] = None
    startTime: Optional[float] = None
    endTime: Optional[float] = None
    duration: Optional[float] = None
    text: Optional[str] = None
    assetUrl: Optional[str] = None
    speed: Optional[float] = None
    volume: Optional[float] = None
    effectType: Optional[str] = None
    reasoning: Optional[str] = None
    # For transitions
    transitionType: Optional[str] = None
    # For zoom
    zoomLevel: Optional[float] = None
    
    # For captions
    style: Optional[Dict[str, Any]] = None  # Holds SubtitleStyle


class SubtitleStyle(BaseModel):
    fontFamily: str = "Komika Axis"
    fontSize: int = 60
    color: str = "#FFFFFF"
    stroke: str = "#000000"
    strokeWidth: int = 4
    highlightColor: str = "#FACC15"
    backgroundColor: str = "transparent"
    textAlign: str = "center" # left, center, right
    verticalPosition: float = 0.8 # 0.0 top, 1.0 bottom
    bold: bool = True
    italic: bool = False
    shadow: bool = True
    animation: str = "pop_in"
    highlightWords: List[str] = []



class EditManifest(BaseModel):
    """
    Representation of the editor state sent by the frontend.
    Accepts all fields the frontend provides via extra='allow'.
    """
    model_config = ConfigDict(extra='allow')

    version: str = "1.0"
    job_id: Optional[str] = None
    jobId: Optional[str] = None  # Frontend sends camelCase
    timeline: Dict[str, Any] = {}
    clips: List[Dict[str, Any]] = []
    audio: Any = []  # Can be list of clips or settings object
    source: Optional[Dict[str, Any]] = None
    transitions: Optional[List[Dict[str, Any]]] = []
    createdAt: Optional[str] = None
    modifiedAt: Optional[str] = None
    export: Optional[Dict[str, Any]] = None


class AgentRequest(BaseModel):
    prompt: str
    manifest: EditManifest
    context: Optional[Dict[str, Any]] = {}


class AgentResponse(BaseModel):
    agent_id: str
    actions: List[AgentAction]
    reasoning: str
    status: Optional[AgentStatus] = AgentStatus.READY
    status_message: Optional[str] = None
