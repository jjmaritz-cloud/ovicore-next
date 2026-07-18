from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db
from app.routers.auth import get_current_user


router = APIRouter(
    prefix="/api/notes",
    tags=["App Notes"],
)


def require_global_admin(
    current_user: models.AppUser,
) -> None:
    if not current_user.is_global_admin:
        raise HTTPException(
            status_code=403,
            detail="Global Admin access required",
        )


@router.get(
    "",
    response_model=list[schemas.AppNoteOut],
)
def list_notes(
    module: str | None = None,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_global_admin(current_user)

    query = db.query(models.AppNote)

    if module:
        query = query.filter(
            models.AppNote.module == module
        )

    return (
        query.order_by(
            models.AppNote.is_done.asc(),
            models.AppNote.created_at.desc(),
        )
        .all()
    )


@router.post(
    "",
    response_model=schemas.AppNoteOut,
)
def create_note(
    payload: schemas.AppNoteCreate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_global_admin(current_user)

    note = models.AppNote(
        **payload.model_dump()
    )

    if note.is_done and not note.completed_at:
        note.completed_at = datetime.utcnow()

    db.add(note)
    db.commit()
    db.refresh(note)

    return note


@router.patch(
    "/{note_id}",
    response_model=schemas.AppNoteOut,
)
def update_note(
    note_id: int,
    payload: schemas.AppNoteUpdate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_global_admin(current_user)

    note = (
        db.query(models.AppNote)
        .filter(models.AppNote.id == note_id)
        .first()
    )

    if not note:
        raise HTTPException(
            status_code=404,
            detail="Note not found",
        )

    update_data = payload.model_dump(
        exclude_unset=True
    )

    for key, value in update_data.items():
        setattr(note, key, value)

    if note.is_done and not note.completed_at:
        note.completed_at = datetime.utcnow()

    if not note.is_done:
        note.completed_at = None

    db.commit()
    db.refresh(note)

    return note


@router.delete("/{note_id}")
def delete_note(
    note_id: int,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_global_admin(current_user)

    note = (
        db.query(models.AppNote)
        .filter(models.AppNote.id == note_id)
        .first()
    )

    if not note:
        raise HTTPException(
            status_code=404,
            detail="Note not found",
        )

    db.delete(note)
    db.commit()

    return {"ok": True}


@router.get(
    "/{note_id}/comments",
    response_model=list[schemas.AppNoteCommentOut],
)
def list_note_comments(
    note_id: int,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_global_admin(current_user)

    return (
        db.query(models.AppNoteComment)
        .filter(
            models.AppNoteComment.note_id == note_id
        )
        .order_by(
            models.AppNoteComment.created_at.asc()
        )
        .all()
    )


@router.post(
    "/{note_id}/comments",
    response_model=schemas.AppNoteCommentOut,
)
def create_note_comment(
    note_id: int,
    payload: schemas.AppNoteCommentCreate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_global_admin(current_user)

    note = (
        db.query(models.AppNote)
        .filter(models.AppNote.id == note_id)
        .first()
    )

    if not note:
        raise HTTPException(
            status_code=404,
            detail="Note not found",
        )

    comment = models.AppNoteComment(
        note_id=note_id,
        author=payload.author,
        comment=payload.comment,
    )

    db.add(comment)
    db.commit()
    db.refresh(comment)

    return comment