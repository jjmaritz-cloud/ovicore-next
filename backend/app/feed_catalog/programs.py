"""Tenant-scoped, immutable approved feeding programs and flock links.

Schedules are advisory; actual feeding remains in dated energy assignment records.
"""
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, select, UniqueConstraint
from sqlalchemy.orm import Session


def declare_program_models(Base):
    class FeedProgram(Base):
        __tablename__ = "feed_approved_programs"
        id = Column(String(64), primary_key=True)
        company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
        mill_id = Column(String(64), nullable=False)
        name = Column(String(160), nullable=False)
        version = Column(Integer, nullable=False)
        stages = Column(JSON, nullable=False)
        status = Column(String(20), nullable=False, default="Approved")
        created_by = Column(String(160), nullable=False)
        created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
        __table_args__ = (UniqueConstraint("company_id", "mill_id", "name", "version", name="uq_feed_program_version"),)

    class FlockFeedProgram(Base):
        __tablename__ = "feed_flock_program_links"
        id = Column(String(64), primary_key=True)
        company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
        flock_id = Column(Integer, nullable=False, index=True)
        program_id = Column(String(64), nullable=False)
        assigned_by = Column(String(160), nullable=False)
        assigned_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
        __table_args__ = (UniqueConstraint("company_id", "flock_id", name="uq_feed_flock_program"),)
    return FeedProgram, FlockFeedProgram


class StageIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start_week: int = Field(ge=0, le=120)
    end_week: int = Field(ge=0, le=130)
    ration_id: str = Field(min_length=1, max_length=64)

class ProgramIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=160)
    mill_id: str = Field(min_length=1, max_length=64)
    stages: list[StageIn] = Field(min_length=1, max_length=20)

class LinkIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    flock_id: int = Field(gt=0)
    program_id: str = Field(min_length=1, max_length=64)


def make_program_router(get_db, get_current_user, resolve_company_id, has_farm_access,
                        flock_model, ration_model, mill_model, program_model, link_model):
    router = APIRouter(prefix="/api/feed-operations/programs", tags=["Feeding Programs"])

    def context(db, user, company_id):
        cid = resolve_company_id(user, company_id)
        return cid

    def editor(user):
        if not (user.is_global_admin or user.is_company_admin):
            raise HTTPException(403, "Company or Global Admin required")

    def check_flock(db, user, cid, flock_id):
        flock = db.execute(select(flock_model).where(flock_model.id == flock_id, flock_model.company_id == cid)).scalar_one_or_none()
        if flock is None: raise HTTPException(404, "Flock not found in company")
        if not has_farm_access(db, user, flock.farm_id): raise HTTPException(403, "No farm access")
        return flock

    def display(p):
        return {"id": p.id, "name": p.name, "mill_id": p.mill_id, "version": p.version,
                "status": p.status, "stages": p.stages, "created_at": p.created_at.isoformat() if p.created_at else None}

    @router.get("")
    def list_programs(company_id: int | None = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
        cid = context(db, user, company_id)
        return [display(p) for p in db.execute(select(program_model).where(program_model.company_id == cid).order_by(program_model.name, program_model.version.desc())).scalars()]

    @router.post("", status_code=201)
    def create(body: ProgramIn, company_id: int | None = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
        editor(user)
        cid = context(db, user, company_id)
        mill = db.execute(select(mill_model).where(mill_model.id == body.mill_id, mill_model.company_id == cid)).scalar_one_or_none()
        if mill is None: raise HTTPException(422, "Mill does not belong to company")
        stages = sorted(body.stages, key=lambda s: s.start_week)
        for i, s in enumerate(stages):
            if s.end_week < s.start_week: raise HTTPException(422, "End week before start week")
            if i and s.start_week <= stages[i-1].end_week: raise HTTPException(422, "Overlapping feeding stages")
        snapshots = []
        for s in stages:
            ration = db.execute(select(ration_model).where(ration_model.id == s.ration_id,
                ration_model.company_id == cid, ration_model.mill_id == body.mill_id,
                ration_model.status == "Approved")).scalar_one_or_none()
            if not ration: raise HTTPException(422, f"Approved mill ration not found: {s.ration_id}")
            snapshots.append({"start_week": s.start_week, "end_week": s.end_week,
                              "ration_id": ration.id, "ration_code": ration.code,
                              "ration_name": ration.name, "mill_id": ration.mill_id})
        previous = db.execute(select(program_model).where(program_model.company_id == cid,
            program_model.mill_id == body.mill_id, program_model.name == body.name).order_by(program_model.version.desc())).scalars().first()
        new = program_model(id=str(uuid4()), company_id=cid, mill_id=body.mill_id,
            name=body.name, version=previous.version + 1 if previous else 1,
            stages=snapshots, status="Approved", created_by=str(getattr(user,"email",None) or user.id))
        db.add(new); db.commit(); db.refresh(new)
        return display(new)

    @router.get("/flock")
    def read_flock(flock_id: int = Query(gt=0), company_id: int | None = None,
                   db: Session = Depends(get_db), user=Depends(get_current_user)):
        cid = context(db, user, company_id)
        check_flock(db, user, cid, flock_id)
        link = db.execute(select(link_model).where(link_model.company_id == cid, link_model.flock_id == flock_id)).scalar_one_or_none()
        if not link: return {"program": None, "assigned_at": None}
        program = db.execute(select(program_model).where(program_model.company_id == cid,
            program_model.id == link.program_id)).scalar_one_or_none()
        return {"program": display(program) if program else None,
                "assigned_at": link.assigned_at.isoformat() if link.assigned_at else None}

    @router.put("/flock")
    def assign(body: LinkIn, company_id: int | None = None,
               db: Session = Depends(get_db), user=Depends(get_current_user)):
        editor(user)
        cid = context(db, user, company_id)
        check_flock(db, user, cid, body.flock_id)
        program = db.execute(select(program_model).where(program_model.company_id == cid,
            program_model.id == body.program_id, program_model.status == "Approved")).scalar_one_or_none()
        if not program: raise HTTPException(422, "Approved program not found")
        link = db.execute(select(link_model).where(link_model.company_id == cid, link_model.flock_id == body.flock_id)).scalar_one_or_none()
        if link: link.program_id = program.id; link.assigned_at = datetime.now(timezone.utc); link.assigned_by = str(getattr(user,"email",None) or user.id)
        else: db.add(link_model(id=str(uuid4()), company_id=cid, flock_id=body.flock_id,
                               program_id=program.id, assigned_by=str(getattr(user,"email",None) or user.id)))
        db.commit()
        return {"program": display(program), "message": "Feeding program linked; actual ration history unchanged"}

    return router
