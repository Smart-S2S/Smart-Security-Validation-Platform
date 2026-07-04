from pydantic import BaseModel, Field


class ActionIntent(BaseModel):
    action: str = Field(min_length=2, max_length=120)
    target: str = Field(min_length=1, max_length=255)
    reason: str = Field(min_length=3, max_length=2000)
    parameters: dict = Field(default_factory=dict)


class ToolExecutionResult(BaseModel):
    ok: bool
    status: str
    action: str
    target: str
    risk_level: str
    approval_required: bool
    tool_name: str
    output: dict = Field(default_factory=dict)
