"""Feed Operations catalogue with server-validated tenant selection.

Global admins MUST specify company_id in query string. Everyone else is pinned to
principal.company_id, regardless of a supplied company_id. Existing OviCore auth
and editor dependency are supplied by app/main.py.
"""
from decimal import Decimal
from typing import Any, Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

class MillIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=64)
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=255)
    kind: Literal["Company Mill", "External Mill"]
    location: str = ""
    contact: str = ""
    email: str = ""
    phone: str = ""
    status: Literal["Active", "Inactive"]
    notes: str = ""

class IngredientIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=64)
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=255)
    category: str
    price: Decimal = Field(ge=0, max_digits=14, decimal_places=4)
    protein: str = ""
    energy: str = ""
    status: Literal["Active", "Inactive"]
    notes: str = ""

class Line(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ingredientId: str = Field(min_length=1, max_length=64)
    percent: float = Field(gt=0, le=100, allow_inf_nan=False)

class RationIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=64)
    millId: str = Field(min_length=1, max_length=64)
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=255)
    supplierCode: str = Field(min_length=1, max_length=64)
    supplierName: str = Field(min_length=1, max_length=255)
    phase: str
    type: Literal["Base", "Medicated"]
    baseId: str = ""
    status: Literal["Draft", "Approved", "Inactive"]
    notes: str = ""
    lines: list[Line] = Field(default_factory=list)


def make_feed_catalog_router(get_db, get_current_user, models, require_feed_editor):
    Mill, Ingredient, Ration = models
    router = APIRouter(prefix="/api/feed-operations/catalog", tags=["Feed Operations"])

    def company(db, principal, selected):
        if bool(principal.is_global_admin):
            if selected is None:
                raise HTTPException(400, "Global Admin must select company_id")
            cid = selected
        else:
            cid = getattr(principal, "company_id", None)
            if cid is None or (selected is not None and selected != cid):
                raise HTTPException(403, "Company access denied")
        # Confirm the tenant actually exists and is active, not just a valid integer.
        from app.models import Company
        exists = db.execute(select(Company.id).where(Company.id == cid, Company.active.is_(True))).scalar_one_or_none()
        if exists is None:
            raise HTTPException(404, "Company not found or inactive")
        return cid

    def lookup(db, cls, cid, item_id):
        item = db.execute(select(cls).where(cls.id == item_id, cls.company_id == cid)).scalar_one_or_none()
        if item is None:
            raise HTTPException(404, "Record not found for selected company")
        return item

    def serialize(m, kind):
        fields = {
            "mills": ("id", "code", "name", "kind", "location", "contact", "email", "phone", "status", "notes"),
            "ingredients": ("id", "code", "name", "category", "price", "protein", "energy", "status", "notes"),
            "rations": ("id", "code", "name", "phase", "type", "status", "notes", "lines"),
        }[kind]
        out = {k: getattr(m, k) for k in fields}
        if kind == "ingredients":
            out["price"] = float(m.price)  # JSON frontend compatibility; DB retains exact decimal.
        if kind == "rations":
            out.update(millId=m.mill_id, supplierCode=m.supplier_code,
                       supplierName=m.supplier_name, baseId=m.base_id or "")
        return out

    @router.get("")
    def list_catalog(company_id: int | None = Query(default=None, ge=1),
                     db: Session = Depends(get_db), principal=Depends(get_current_user)):
        cid = company(db, principal, company_id)
        return {kind: [serialize(m, kind) for m in db.execute(select(cls).where(cls.company_id == cid)).scalars().all()]
                for kind, cls in (("mills", Mill), ("ingredients", Ingredient), ("rations", Ration))}

    @router.put("/{kind}/{item_id}")
    def upsert(kind: Literal["mills", "ingredients", "rations"], item_id: str,
               data: dict[str, Any], company_id: int | None = Query(default=None, ge=1),
               db: Session = Depends(get_db), principal=Depends(get_current_user),
               _editor=Depends(require_feed_editor)):
        cid = company(db, principal, company_id)
        cls, schema = {"mills": (Mill, MillIn), "ingredients": (Ingredient, IngredientIn),
                       "rations": (Ration, RationIn)}[kind]
        body = schema.model_validate(data)
        if body.id != item_id:
            raise HTTPException(400, "ID mismatch")
        # Avoid cross-company collision of globally unique primary keys.
        item = db.get(cls, item_id)
        if item is not None and item.company_id != cid:
            raise HTTPException(409, "Record ID already used; generate another ID")
        if item is None:
            item = cls(id=item_id, company_id=cid)
            db.add(item)
        values = body.model_dump()
        if kind == "mills":
            if body.status == "Inactive":
                active_rations = db.execute(select(Ration.id).where(
                    Ration.company_id == cid, Ration.mill_id == item_id,
                    Ration.status == "Approved")).first()
                if active_rations:
                    raise HTTPException(422, "Cannot inactivate a mill with approved rations")
        if kind == "ingredients":
            if body.status == "Inactive":
                for ration in db.execute(select(Ration).where(Ration.company_id == cid, Ration.status == "Approved")).scalars():
                    if any(line.get("ingredientId") == item_id for line in (ration.lines or [])):
                        raise HTTPException(422, "Ingredient is used by an approved ration")
        if kind == "rations":
            mill = lookup(db, Mill, cid, values.pop("millId"))
            if mill.status != "Active" and (item.mill_id is None or item.mill_id != mill.id):
                raise HTTPException(422, "Assigned mill is inactive")
            # Keep approved dependants intact when base ration changes.
            dependants = db.execute(select(Ration).where(Ration.company_id == cid,
                Ration.base_id == item_id, Ration.status == "Approved")).scalars().all()
            if dependants and (body.type != "Base" or body.status != "Approved" or any(d.mill_id != mill.id for d in dependants)):
                raise HTTPException(422, "Cannot alter an approved base ration with approved medicated dependants")
            item.mill_id = mill.id
            item.supplier_code = values.pop("supplierCode").strip().upper()
            item.supplier_name = values.pop("supplierName").strip()
            item.base_id = values.pop("baseId") or None
            values["lines"] = [line.model_dump() for line in body.lines]
            refs = [x["ingredientId"] for x in values["lines"]]
            if len(set(refs)) != len(refs):
                raise HTTPException(422, "Duplicate ingredients")
            for ingredient_id in refs:
                ing = lookup(db, Ingredient, cid, ingredient_id)
                if ing.status != "Active" and body.status == "Approved":
                    raise HTTPException(422, "Approved ration cannot contain inactive ingredients")
            total = sum(x["percent"] for x in values["lines"])
            if total > 100.001 or (body.status == "Approved" and (not refs or abs(total - 100) > 0.001)):
                raise HTTPException(422, "Invalid ingredient inclusion total")
            if body.type == "Medicated":
                if not item.base_id or item.base_id == item_id:
                    raise HTTPException(422, "Select a different base ration")
                base = lookup(db, Ration, cid, item.base_id)
                if base.mill_id != item.mill_id or base.type != "Base" or base.status != "Approved":
                    raise HTTPException(422, "Base must be approved and belong to the same mill")
            else:
                item.base_id = None
        for field, value in values.items():
            if field != "id":
                setattr(item, field, value)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Duplicate code, supplier SKU or database constraint violation")
        except Exception:
            db.rollback()
            raise
        db.refresh(item)
        return serialize(item, kind)
    from .bulk_import import attach_bulk_import
    attach_bulk_import(router, get_db, get_current_user, require_feed_editor, company, models)
    return router
