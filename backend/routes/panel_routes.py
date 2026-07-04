from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth import get_current_user
from backend.services.offer_store import create_offer, list_offers, update_offer_status


router = APIRouter()


class OfferCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=160)
    company: str = Field(default="", max_length=160)
    phone: str = Field(default="", max_length=60)
    message: str = Field(min_length=10, max_length=4000)
    language: str = Field(default="tr", pattern="^(tr|en)$")


class OfferStatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(new|reviewed|approved|rejected)$")


def _require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("is_admin"):
        return current_user

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin yetkisi gerekli")


@router.post("/offers", status_code=201)
def create_offer_entry(payload: OfferCreateRequest):
    item = create_offer(
        name=payload.name.strip(),
        email=payload.email.strip(),
        company=payload.company.strip(),
        phone=payload.phone.strip(),
        message=payload.message.strip(),
        language=payload.language,
    )
    return {"ok": True, "item": item}


@router.get("/panel/offers")
def panel_offers(current_user: dict = Depends(_require_admin)):
    del current_user
    return {"items": list_offers()}


@router.patch("/panel/offers/{offer_id}")
def panel_offer_status_update(
    offer_id: int,
    payload: OfferStatusUpdateRequest,
    current_user: dict = Depends(_require_admin),
):
    del current_user
    updated = update_offer_status(offer_id, payload.status)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teklif bulunamadi")

    return {"item": updated}
