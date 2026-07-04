from pydantic import BaseModel, Field


class WorkflowStepCreateRequest(BaseModel):
    step_key: str = Field(min_length=2, max_length=80)
    step_name: str = Field(min_length=2, max_length=140)
    description: str = Field(default="", max_length=1000)
    sort_order: int = Field(default=100, ge=1, le=10000)
    role_required: str = Field(default="test", min_length=2, max_length=64)
    ai_prompt_hint: str = Field(default="", max_length=4000)
    is_active: bool = True


class WorkflowStepUpdateRequest(BaseModel):
    step_name: str | None = Field(default=None, min_length=2, max_length=140)
    description: str | None = Field(default=None, max_length=1000)
    sort_order: int | None = Field(default=None, ge=1, le=10000)
    role_required: str | None = Field(default=None, min_length=2, max_length=64)
    ai_prompt_hint: str | None = Field(default=None, max_length=4000)
    is_active: bool | None = None


class ToolCreateRequest(BaseModel):
    action_key: str = Field(min_length=2, max_length=120)
    tool_name: str = Field(min_length=1, max_length=120)
    display_name: str = Field(min_length=2, max_length=160)
    tool_type: str = Field(default="scanner", min_length=2, max_length=64)
    module_path: str = Field(default="", max_length=255)
    executable_path: str = Field(default="", max_length=255)
    base_command: str = Field(default="", max_length=2000)
    risk_level: str = Field(default="low", min_length=3, max_length=16)
    timeout_sec: int = Field(default=300, ge=5, le=7200)
    requires_approval: bool = True
    wordlist_path: str = Field(default="", max_length=255)
    payload_path: str = Field(default="", max_length=255)
    template_path: str = Field(default="", max_length=255)
    is_active: bool = True


class ToolUpdateRequest(BaseModel):
    tool_name: str | None = Field(default=None, min_length=1, max_length=120)
    display_name: str | None = Field(default=None, min_length=2, max_length=160)
    tool_type: str | None = Field(default=None, min_length=2, max_length=64)
    module_path: str | None = Field(default=None, max_length=255)
    executable_path: str | None = Field(default=None, max_length=255)
    base_command: str | None = Field(default=None, max_length=2000)
    risk_level: str | None = Field(default=None, min_length=3, max_length=16)
    timeout_sec: int | None = Field(default=None, ge=5, le=7200)
    requires_approval: bool | None = None
    wordlist_path: str | None = Field(default=None, max_length=255)
    payload_path: str | None = Field(default=None, max_length=255)
    template_path: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class ToolParameterCreateRequest(BaseModel):
    param_key: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=160)
    param_type: str = Field(default="string", min_length=3, max_length=32)
    default_value: str = Field(default="", max_length=2000)
    is_required: bool = False
    is_editable: bool = True
    options_json: dict | list = Field(default_factory=dict)
    sort_order: int = Field(default=100, ge=1, le=10000)


class ToolParameterUpdateRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=160)
    param_type: str | None = Field(default=None, min_length=3, max_length=32)
    default_value: str | None = Field(default=None, max_length=2000)
    is_required: bool | None = None
    is_editable: bool | None = None
    options_json: dict | list | None = None
    sort_order: int | None = Field(default=None, ge=1, le=10000)
