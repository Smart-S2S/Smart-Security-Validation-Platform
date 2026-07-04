from pydantic import BaseModel, Field


class ToolCreateRequest(BaseModel):
    step_id: int | None = Field(default=None, ge=1)
    action_key: str = Field(min_length=2, max_length=120)
    tool_name: str = Field(default="", max_length=120)
    display_name: str = Field(min_length=2, max_length=160)
    workflow_key: str = Field(default="scan", min_length=2, max_length=32)
    test_category: str = Field(default="general", min_length=2, max_length=120)
    step_key: str = Field(default="custom_step", min_length=2, max_length=160)
    step_display_name: str = Field(default="", max_length=160)
    step_description: str = Field(default="", max_length=2000)
    script_filename: str = Field(default="", max_length=255)
    script_source: str = Field(default="", max_length=200000)
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
    step_id: int | None = Field(default=None, ge=1)
    action_key: str | None = Field(default=None, min_length=2, max_length=120)
    tool_name: str | None = Field(default=None, min_length=1, max_length=120)
    display_name: str | None = Field(default=None, min_length=2, max_length=160)
    workflow_key: str | None = Field(default=None, min_length=2, max_length=32)
    test_category: str | None = Field(default=None, min_length=2, max_length=120)
    step_key: str | None = Field(default=None, min_length=2, max_length=160)
    step_display_name: str | None = Field(default=None, max_length=160)
    step_description: str | None = Field(default=None, max_length=2000)
    script_filename: str | None = Field(default=None, max_length=255)
    script_source: str | None = Field(default=None, max_length=200000)
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


class ToolScriptCreateRequest(BaseModel):
    script_name: str = Field(min_length=1, max_length=160)
    filename: str = Field(default="", max_length=255)
    script_source: str = Field(min_length=1, max_length=200000)
    sort_order: int = Field(default=100, ge=1, le=10000)
    is_active: bool = True


class ToolScriptUpdateRequest(BaseModel):
    script_name: str | None = Field(default=None, min_length=1, max_length=160)
    filename: str | None = Field(default=None, max_length=255)
    script_source: str | None = Field(default=None, min_length=1, max_length=200000)
    sort_order: int | None = Field(default=None, ge=1, le=10000)
    is_active: bool | None = None


class StepCreateRequest(BaseModel):
    step_key: str = Field(min_length=2, max_length=160)
    display_name: str = Field(min_length=2, max_length=160)
    workflow_key: str = Field(default="scan", min_length=2, max_length=32)
    category_key: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=2000)
    is_active: bool = True


class StepUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None


class StepItemCreateRequest(BaseModel):
    item_type: str = Field(min_length=4, max_length=16)
    item_key: str = Field(default="", max_length=120)
    display_name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=2000)
    is_active: bool = True


class StepItemUpdateRequest(BaseModel):
    item_type: str | None = Field(default=None, min_length=4, max_length=16)
    item_key: str | None = Field(default=None, min_length=2, max_length=120)
    display_name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None


class StepItemParameterCreateRequest(BaseModel):
    param_key: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=160)
    param_type: str = Field(default="string", min_length=3, max_length=32)
    default_value: str = Field(default="", max_length=2000)
    description: str = Field(default="", max_length=2000)
    options_json: dict | list = Field(default_factory=list)
    is_required: bool = False
    sort_order: int = Field(default=100, ge=1, le=10000)


class StepItemParameterUpdateRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=160)
    param_type: str | None = Field(default=None, min_length=3, max_length=32)
    default_value: str | None = Field(default=None, max_length=2000)
    description: str | None = Field(default=None, max_length=2000)
    options_json: dict | list | None = None
    is_required: bool | None = None
    sort_order: int | None = Field(default=None, ge=1, le=10000)


class StepItemScriptContentUpdateRequest(BaseModel):
    script_source: str = Field(default="", max_length=200000)
