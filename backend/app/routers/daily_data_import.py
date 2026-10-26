from datetime import date, datetime
from io import BytesIO
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["Daily Data Import"])

MODULES: dict[str, dict[str, Any]] = {
    "broilers": {
        "label": "Broilers",
        "flock_model": models.BroilerPlacementPlan,
        "daily_model": models.BroilerDailyPerformance,
        "flock_code": "cycle_code",
        "fk": "placement_plan_id",
        "start_date": "placement_date",
        "opening": "planned_birds",
        "fields": [
            "Mortality Front", "Mortality Middle", "Mortality Back", "Mortality Other",
            "Cull Legs", "Cull Runts", "Cull Beak", "Cull Other",
            "Feed kg", "Water L", "Bodyweight kg", "Notes",
        ],
    },
    "breeder_rearing": {
        "label": "Breeder Rearing",
        "flock_model": models.BreederRearingFlock,
        "daily_model": models.BreederRearingDailyPerformance,
        "flock_code": "flock_code",
        "fk": "flock_id",
        "start_date": "hatch_date",
        "opening": None,
        "fields": [
            "Opening Female Birds", "Female Mortality", "Female Culls",
            "Opening Male Birds", "Male Mortality", "Male Culls",
            "Feed kg", "Water L", "Female Bodyweight kg", "Male Bodyweight kg", "Notes",
        ],
    },
    "breeder_production": {
        "label": "Breeder Production",
        "flock_model": models.BreederProductionFlock,
        "daily_model": models.BreederProductionDailyPerformance,
        "flock_code": "flock_code",
        "fk": "flock_id",
        "start_date": "hatch_date",
        "opening": None,
        "fields": [
            "Opening Female Birds", "Female Mortality", "Female Culls",
            "Opening Male Birds", "Male Mortality", "Male Culls",
            "Feed kg", "Water L", "Female Bodyweight kg", "Male Bodyweight kg",
            "Total Eggs", "Hatching Eggs", "Floor Eggs", "Rejects",
            "Production Standard %", "Notes",
        ],
    },
    "commercial_rearing": {
        "label": "Commercial Rearing",
        "flock_model": models.LayerRearingFlock,
        "daily_model": models.LayerRearingDailyPerformance,
        "flock_code": "flock_code",
        "fk": "flock_id",
        "start_date": "hatch_date",
        "opening": "birds_placed",
        "fields": [
            "Mortality Front", "Mortality Middle", "Mortality Back", "Mortality Other",
            "Cull Legs", "Cull Runts", "Cull Beak", "Cull Other",
            "Feed kg", "Water L", "Bodyweight kg", "Notes",
        ],
    },
    "commercial_layers": {
        "label": "Commercial Layers",
        "flock_model": models.CommercialLayerFlock,
        "daily_model": models.CommercialLayerDailyPerformance,
        "flock_code": "flock_code",
        "fk": "flock_id",
        "start_date": "hatch_date",
        "opening": "birds_housed",
        "fields": [
            "Mortality Birds", "Cull Birds", "Total Eggs", "Saleable Eggs",
            "Seconds", "Cracks", "Rejects", "Egg Weight g",
            "Feed kg", "Water L", "Bodyweight g", "Production Standard %",
            "Mortality Standard %", "Egg Weight Standard g", "Feed Standard g/bird/day",
            "Eggs per Bird Standard", "Bodyweight Standard g", "Notes",
        ],
    },
}

COMMON_HEADERS = ["Flock Code", "Entry Date", "Age Days"]


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _date(value: Any, row: int, errors: list[str]) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    raw = _text(value)
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            pass
    errors.append(f"Row {row}: Entry Date is invalid.")
    return None


def _number(value: Any, name: str, row: int, errors: list[str], integer: bool = False):
    if value is None or _text(value) == "":
        return None
    try:
        number = float(value)
        return int(number) if integer else number
    except (TypeError, ValueError):
        errors.append(f"Row {row}: {name} must be numeric.")
        return None


# Column names matching the Commercial Layers Daily House Card. Derived cells
# are deliberately ignored by the importer; the server recalculates bird flow.
LAYER_SHEET_HEADERS = [
    "Entry Date", "Age Days", "Age Weeks", "Opening Birds", "Mortality Birds",
    "Cull Birds", "Total Loss", "Closing Birds", "Bird Balance", "Feed kg",
    "Water L", "Feed g/Bird", "Bodyweight (kg)", "Total Eggs", "Saleable Eggs",
    "Seconds", "Cracks", "Rejects", "Production %", "Production Standard %",
    "Variance %", "Saleable %", "Feed kg/Dozen", "Notes",
]
LAYER_INPUT_FIELDS = {
    "Mortality Birds", "Cull Birds", "Feed kg", "Water L", "Bodyweight (kg)",
    "Total Eggs", "Saleable Eggs", "Seconds", "Cracks", "Rejects",
    "Production Standard %", "Notes",
}


def _records(workbook, module: str = "") -> list[tuple[int, dict[str, Any]]]:
    # Keep legacy Daily Data imports working for every production module.
    if "Daily Data" in workbook.sheetnames:
        sheet = workbook["Daily Data"]
        headers = [_text(cell.value) for cell in next(sheet.iter_rows(min_row=1, max_row=1))]
        rows = []
        for row_number, cells in enumerate(sheet.iter_rows(min_row=2), start=2):
            values = [cell.value for cell in cells]
            if not any(value is not None and _text(value) for value in values):
                continue
            rows.append((row_number, {headers[i]: values[i] if i < len(values) else None for i in range(len(headers)) if headers[i]}))
        return rows

    if module != "commercial_layers":
        return []
    rows = []
    for sheet in workbook.worksheets:
        if sheet.title.lower() in {"instructions", "read me"}:
            continue
        # Company-specific sheet identity is stored explicitly, not inferred
        # only from Excel's truncated 31-character worksheet title.
        flock_code = _text(sheet["B4"].value)
        if not flock_code:
            continue
        headers = [_text(cell.value) for cell in sheet[11]]
        if headers[:3] != LAYER_SHEET_HEADERS[:3]:
            continue
        for row_number, cells in enumerate(sheet.iter_rows(min_row=12), start=12):
            values = [cell.value for cell in cells]
            row = {header: values[i] if i < len(values) else None for i, header in enumerate(headers) if header}
            # A prefilled date/formula is not an import record until at least
            # one daily input is entered by the user.
            if not any(row.get(key) is not None and _text(row.get(key)) for key in LAYER_INPUT_FIELDS):
                continue
            row["Flock Code"] = flock_code
            rows.append((row_number, row))
    return rows


def _module_enabled(company, module: str) -> bool:
    if module in {"broilers"}:
        return bool(company.enable_broilers)
    if module in {"breeder_rearing", "breeder_production"}:
        return bool(company.enable_breeders)
    if module in {"commercial_rearing", "commercial_layers"}:
        return bool(company.enable_layers)
    return False


def _require_admin(user):
    if not (user.is_global_admin or user.is_company_admin):
        raise HTTPException(status_code=403, detail="Admin access required")


def _resolve_company(db: Session, user, company_id: int):
    _require_admin(user)
    if not user.is_global_admin and user.company_id != company_id:
        raise HTTPException(status_code=403, detail="You do not have access to this company")
    company = db.query(models.Company).filter(models.Company.id == company_id, models.Company.active == True).first()
    if not company:
        raise HTTPException(status_code=404, detail="Selected company was not found or is inactive")
    return company


def _commercial_layers_workbook(db: Session, company_id: int):
    flocks = (db.query(models.CommercialLayerFlock)
              .filter(models.CommercialLayerFlock.company_id == company_id)
              .order_by(models.CommercialLayerFlock.flock_code.asc()).all())
    if not flocks:
        raise HTTPException(status_code=404, detail="No Commercial Layers flocks exist for the selected company")
    wb = Workbook()
    instructions = wb.active
    instructions.title = "Instructions"
    instructions.append(["OviCore | Commercial Layers Daily History Import"])
    for message in [
        "One worksheet per registered laying flock; do not rename or change its Flock Code (B4).",
        "Housing Date is the first daily entry; Hatch Date determines biological age.",
        "Enter data into yellow columns only. Leave missing values blank; do not fill missing days with zeros.",
        "The calculated columns are for review only and are recalculated by OviCore after import.",
        "Blank daily rows are ignored. Validate the workbook in Admin > Data Import before confirming.",
        "When updating existing entries, empty imported cells leave those existing values unchanged.",
        "If Hatch Date or Housing Date is wrong, fix the flock master register and download again.",
    ]:
        instructions.append([message])
    instructions.column_dimensions["A"].width = 115
    instructions["A1"].font = Font(size=16, bold=True, color="075444")

    names = {"Instructions"}
    from datetime import timedelta
    for flock in flocks:
        name = "".join("_" if ch in "[]:*?/\\" else ch for ch in (flock.flock_code or str(flock.id)))[:31] or f"Flock{flock.id}"
        base = name
        index = 2
        while name.lower() in {n.lower() for n in names}:
            suffix = f"-{index}"
            name = base[:31-len(suffix)] + suffix
            index += 1
        names.add(name)
        ws = wb.create_sheet(name)
        farm = db.get(models.BroilerFarm, flock.farm_id)
        shed = db.get(models.BroilerShed, flock.shed_id)
        ws.merge_cells("A1:X2")
        ws["A1"] = "OVICORE  |  COMMERCIAL LAYERS DAILY HOUSE CARD"
        ws["A1"].fill = PatternFill("solid", fgColor="075444")
        ws["A1"].font = Font(size=14, bold=True, color="FFFFFF")
        ws["A1"].alignment = Alignment(vertical="center")
        for row, label, value in [
            (4, "Flock Code", flock.flock_code),
            (5, "Farm", farm.farm_name if farm else ""),
            (6, "Shed", shed.shed_name if shed else ""),
            (7, "Hatch Date", flock.hatch_date),
            (8, "Housing Date", flock.housed_date),
            (9, "Birds Housed", flock.birds_housed),
        ]:
            ws.cell(row, 1, label)
            ws.cell(row, 2, value)
            ws.cell(row, 1).font = Font(color="075444", bold=True)
            ws.cell(row, 2).font = Font(color="075444", bold=True)
            if row in (7, 8):
                ws.cell(row, 2).number_format = "dd-mm-yyyy"
        ws["D4"] = "Yellow = entry  |  Green = calculated  |  Blank = skip"
        ws["D4"].font = Font(italic=True, color="486C60")
        for i, header in enumerate(LAYER_SHEET_HEADERS, start=1):
            cell = ws.cell(11, i, header)
            cell.fill = PatternFill("solid", fgColor="075444")
            cell.font = Font(color="FFFFFF", bold=True, size=10)
            cell.alignment = Alignment(wrap_text=True, horizontal="center")
            ws.column_dimensions[get_column_letter(i)].width = 17 if header != "Notes" else 36
        ws.column_dimensions["A"].width = 17
        ws.column_dimensions["I"].width = 17
        ws.row_dimensions[11].height = 34
        ws.freeze_panes = "D12"
        ws.auto_filter.ref = f"A11:X11"
        # Historical records: first date is the actual housing/transfer date.
        # Use a 1-year grid (or entire history if the flock is older) with
        # editable blanks; users can add more rows as necessary.
        start = flock.housed_date or date.today()
        end = max(date.today(), start + timedelta(days=365))
        days = min((end-start).days + 1, 2500)
        for i in range(days):
            r = 12+i
            current = start + timedelta(days=i)
            ws.cell(r, 1, current).number_format = "dd-mm-yyyy"
            if flock.hatch_date:
                ws.cell(r, 2, max((current-flock.hatch_date).days, 0))
                ws.cell(r, 3, f"=B{r}/7").number_format = "0.00"
            ws.cell(r, 4, (flock.birds_housed or 0) if i == 0 else f"=H{r-1}")
            ws.cell(r, 7, f"=SUM(E{r}:F{r})")
            ws.cell(r, 8, f"=MAX(0,D{r}-G{r})")
            ws.cell(r, 9, f'=IF(D{r}-G{r}=H{r},"OK","Check")')
            ws.cell(r, 12, f'=IFERROR(IF(J{r}="","",J{r}*1000/H{r}),"")')
            ws.cell(r, 19, f'=IFERROR(IF(N{r}="","",N{r}/D{r}*100),"")')
            ws.cell(r, 21, f'=IF(OR(S{r}="",T{r}=""),"",S{r}-T{r})')
            ws.cell(r, 22, f'=IFERROR(IF(O{r}="","",O{r}/N{r}*100),"")')
            ws.cell(r, 23, f'=IFERROR(IF(OR(J{r}="",N{r}=""),"",J{r}/(N{r}/12)),"")')
            for col, header in enumerate(LAYER_SHEET_HEADERS, start=1):
                cell = ws.cell(r, col)
                cell.fill = PatternFill("solid", fgColor="FFF1BD" if header in LAYER_INPUT_FIELDS else "E9F5EE")
                cell.alignment = Alignment(horizontal="center" if col != 24 else "left")
                if col in (3, 19, 21, 22, 23):
                    cell.number_format = "0.00"
    return wb


@router.get("/daily-data-template/{module}")
def download_daily_template(
    module: str, company_id: int | None = None,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = MODULES.get(module)
    if not config:
        raise HTTPException(status_code=404, detail="Unknown production module")
    if module == "commercial_layers":
        if company_id is None:
            raise HTTPException(status_code=400, detail="Select a company before downloading its flock workbook")
        company = _resolve_company(db, current_user, company_id)
        if not _module_enabled(company, module):
            raise HTTPException(status_code=400, detail="Commercial Layers is not enabled for this company")
        wb = _commercial_layers_workbook(db, company_id)
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="OviCore_Commercial_Layers_Company_{company_id}_Daily_History.xlsx"'})
    wb = Workbook()
    ws = wb.active
    ws.title = "Daily Data"
    headers = COMMON_HEADERS + config["fields"]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="0B5D4B")
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{ws.cell(1, len(headers)).coordinate}"
    for index, header in enumerate(headers, start=1):
        ws.column_dimensions[ws.cell(1, index).column_letter].width = max(14, min(28, len(header) + 3))
    ws.append(["EXAMPLE-FLOCK", date.today(), 0] + [None] * len(config["fields"]))
    instructions = wb.create_sheet("Instructions")
    instructions.append([f"OviCore {config['label']} Daily House Card Import"])
    instructions.append(["Keep the Daily Data sheet name and header names unchanged."])
    instructions.append(["Calculated fields such as closing birds, totals, livability and production percentages are calculated by OviCore."])
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    filename = f"OviCore_{module}_daily_data_template.xlsx"
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _set_common_growout(entry, row, row_number, errors):
    int_map = {
        "mortality_front": "Mortality Front", "mortality_middle": "Mortality Middle",
        "mortality_back": "Mortality Back", "mortality_other": "Mortality Other",
        "cull_legs": "Cull Legs", "cull_runts": "Cull Runts",
        "cull_beak": "Cull Beak", "cull_other": "Cull Other",
    }
    for attr, header in int_map.items():
        setattr(entry, attr, _number(row.get(header), header, row_number, errors, True) or 0)
    entry.mortality_birds = sum(int(getattr(entry, key) or 0) for key in ("mortality_front", "mortality_middle", "mortality_back", "mortality_other"))
    entry.cull_birds = sum(int(getattr(entry, key) or 0) for key in ("cull_legs", "cull_runts", "cull_beak", "cull_other"))
    entry.feed_kg = _number(row.get("Feed kg"), "Feed kg", row_number, errors)
    entry.water_litres = _number(row.get("Water L"), "Water L", row_number, errors)
    entry.avg_weight_kg = _number(row.get("Bodyweight kg"), "Bodyweight kg", row_number, errors)
    entry.notes = _text(row.get("Notes"))


def _set_breeder(entry, row, row_number, errors, production: bool):
    for attr, header in {
        "opening_female_birds": "Opening Female Birds", "female_mortality": "Female Mortality",
        "female_culls": "Female Culls", "opening_male_birds": "Opening Male Birds",
        "male_mortality": "Male Mortality", "male_culls": "Male Culls",
    }.items():
        value = _number(row.get(header), header, row_number, errors, True)
        if value is not None or attr not in {"opening_female_birds", "opening_male_birds"}:
            setattr(entry, attr, value or 0)
    entry.feed_kg = _number(row.get("Feed kg"), "Feed kg", row_number, errors)
    entry.water_litres = _number(row.get("Water L"), "Water L", row_number, errors)
    entry.female_bodyweight_kg = _number(row.get("Female Bodyweight kg"), "Female Bodyweight kg", row_number, errors)
    entry.male_bodyweight_kg = _number(row.get("Male Bodyweight kg"), "Male Bodyweight kg", row_number, errors)
    if production:
        for attr, header in {"total_eggs":"Total Eggs", "hatching_eggs":"Hatching Eggs", "floor_eggs":"Floor Eggs", "rejects":"Rejects"}.items():
            setattr(entry, attr, _number(row.get(header), header, row_number, errors, True) or 0)
        entry.production_standard_pct = _number(row.get("Production Standard %"), "Production Standard %", row_number, errors)
    entry.notes = _text(row.get("Notes"))


def _set_layers(entry, row, row_number, errors):
    # Only populated imported cells may overwrite saved history. A new record
    # uses zero defaults for egg counts and mortality; blank optional metrics
    # remain null. This is essential for safe incremental uploads.
    mappings = {
        "mortality_birds": ("Mortality Birds", True),
        "cull_birds": ("Cull Birds", True),
        "total_eggs": ("Total Eggs", True),
        "saleable_eggs": ("Saleable Eggs", True),
        "seconds": ("Seconds", True),
        "cracks": ("Cracks", True),
        "rejects": ("Rejects", True),
        "egg_weight_g": ("Egg Weight g", False),
        "feed_kg": ("Feed kg", False),
        "water_litres": ("Water L", False),
        "bodyweight_g": ("Bodyweight g", False),
        "production_standard_pct": ("Production Standard %", False),
        "mortality_standard_pct": ("Mortality Standard %", False),
        "egg_weight_standard_g": ("Egg Weight Standard g", False),
        "feed_standard_g_bird_day": ("Feed Standard g/bird/day", False),
        "eggs_per_bird_standard": ("Eggs per Bird Standard", False),
        "bodyweight_standard_g": ("Bodyweight Standard g", False),
    }
    for attr, (header, integer) in mappings.items():
        if row.get(header) is None or _text(row.get(header)) == "":
            continue
        number = _number(row[header], header, row_number, errors, integer)
        if number is not None:
            if number < 0 or (integer and number != float(row[header])):
                errors.append(f"Row {row_number}: {header} must be a nonnegative whole number" if integer else f"Row {row_number}: {header} cannot be negative")
            else:
                setattr(entry, attr, number)
    # Spreadsheet follows the Daily House Card (kg); DB stores grams.
    if row.get("Bodyweight (kg)") is not None and _text(row.get("Bodyweight (kg)")):
        kg = _number(row["Bodyweight (kg)"], "Bodyweight (kg)", row_number, errors)
        if kg is not None:
            if kg < 0:
                errors.append(f"Row {row_number}: Bodyweight (kg) cannot be negative")
            else:
                entry.bodyweight_g = kg * 1000
    if row.get("Notes") is not None and _text(row["Notes"]):
        entry.notes = _text(row["Notes"])


def _recalculate_sequence(db: Session, module: str, flock, user_name: str):
    config = MODULES[module]
    daily = config["daily_model"]
    fk = config["fk"]
    rows = db.query(daily).filter(getattr(daily, fk) == flock.id).order_by(daily.entry_date.asc(), daily.id.asc()).all()
    if module in {"broilers", "commercial_rearing", "commercial_layers"}:
        opening = int(getattr(flock, config["opening"], 0) or 0)
        for entry in rows:
            entry.opening_birds = opening
            if module in {"broilers", "commercial_rearing"}:
                entry.mortality_birds = sum(int(getattr(entry, k) or 0) for k in ("mortality_front","mortality_middle","mortality_back","mortality_other"))
                entry.cull_birds = sum(int(getattr(entry, k) or 0) for k in ("cull_legs","cull_runts","cull_beak","cull_other"))
            entry.closing_birds = max(0, opening - int(entry.mortality_birds or 0) - int(entry.cull_birds or 0))
            opening = entry.closing_birds
            entry.last_saved_by = user_name
            entry.last_saved_at = datetime.utcnow()
    else:
        female = int(getattr(flock, "opening_female_birds", None) or getattr(flock, "female_birds", 0) or 0)
        male = int(getattr(flock, "opening_male_birds", None) or getattr(flock, "male_birds", 0) or 0)
        for entry in rows:
            entry.opening_female_birds = female
            entry.opening_male_birds = male
            entry.closing_female_birds = max(0, female - int(entry.female_mortality or 0) - int(entry.female_culls or 0))
            entry.closing_male_birds = max(0, male - int(entry.male_mortality or 0) - int(entry.male_culls or 0))
            female, male = entry.closing_female_birds, entry.closing_male_birds
            entry.last_saved_by = user_name
            entry.last_saved_at = datetime.utcnow()


@router.post("/daily-data-import")
async def import_daily_data(
    company_id: int = Form(...), module: str = Form(...), commit: bool = Form(False),
    allow_updates: bool = Form(False), workbook: UploadFile = File(...),
    current_user: models.AppUser = Depends(get_current_user), db: Session = Depends(get_db),
):
    company = _resolve_company(db, current_user, company_id)
    config = MODULES.get(module)
    if not config:
        raise HTTPException(status_code=400, detail="Select a valid production module")
    if not _module_enabled(company, module):
        raise HTTPException(status_code=400, detail=f"{config['label']} is not enabled for this company")
    filename = workbook.filename or ""
    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Upload an .xlsx workbook")
    try:
        excel = load_workbook(BytesIO(await workbook.read()), data_only=True, read_only=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read workbook: {exc}")
    records = _records(excel, module)
    errors: list[str] = []
    warnings: list[str] = []
    if not records:
        errors.append("No populated daily input rows found. For Commercial Layers, enter values on a flock worksheet; other modules use Daily Data.")
    flock_model = config["flock_model"]
    daily_model = config["daily_model"]
    flock_rows = db.query(flock_model).filter(flock_model.company_id == company_id).all()
    flock_by_code = {_text(getattr(f, config["flock_code"])).lower(): f for f in flock_rows}
    existing_rows = db.query(daily_model).filter(daily_model.company_id == company_id).all()
    existing_by_key = {(getattr(e, config["fk"]), e.entry_date): e for e in existing_rows}
    parsed = []
    seen = set()
    counts = {"create": 0, "update": 0, "unchanged": 0}
    for row_number, row in records:
        code = _text(row.get("Flock Code"))
        entry_date = _date(row.get("Entry Date"), row_number, errors)
        if not code or not entry_date:
            if not code: errors.append(f"Row {row_number}: Flock Code is required.")
            continue
        flock = flock_by_code.get(code.lower())
        if not flock:
            errors.append(f"Row {row_number}: Flock Code '{code}' was not found in {config['label']}.")
            continue
        key = (flock.id, entry_date)
        if key in seen:
            errors.append(f"Row {row_number}: duplicate entry for '{code}' on {entry_date}.")
            continue
        seen.add(key)
        age_days = _number(row.get("Age Days"), "Age Days", row_number, errors, True)
        start_date = getattr(flock, config["start_date"], None)
        if age_days is None and start_date:
            age_days = (entry_date - start_date).days
        earliest = (flock.housed_date if module == "commercial_layers" else start_date)
        if earliest and entry_date < earliest:
            errors.append(f"Row {row_number}: Entry Date is before the flock housing/start date.")
        if module == "commercial_layers":
            # Validate the same fields in preview and commit, before writing.
            validation_row = type("PreviewRow", (), {})()
            _set_layers(validation_row, row, row_number, errors)
        existing = existing_by_key.get(key)
        counts["create" if existing is None else "update" if allow_updates else "unchanged"] += 1
        parsed.append((row_number, row, flock, entry_date, age_days, existing))
    result = {"company":{"id":company.id,"name":company.company_name}, "module":module, "module_label":config["label"], "filename":filename, "mode":"commit" if commit else "preview", "allow_updates":allow_updates, "committed":False, "actions":{"performance":counts}, "errors":errors, "warnings":warnings, "rows":len(records)}
    if errors or not commit:
        return result
    affected = set()
    try:
        for row_number, row, flock, entry_date, age_days, existing in parsed:
            if existing is not None and not allow_updates:
                continue
            entry = existing or daily_model(company_id=company_id, **{config["fk"]: flock.id}, entry_date=entry_date)
            entry.entry_date = entry_date
            entry.age_days = age_days
            if module in {"broilers", "commercial_rearing"}:
                _set_common_growout(entry, row, row_number, errors)
            elif module in {"breeder_rearing", "breeder_production"}:
                _set_breeder(entry, row, row_number, errors, module == "breeder_production")
            else:
                _set_layers(entry, row, row_number, errors)
            entry.last_saved_by = current_user.full_name
            entry.last_saved_at = datetime.utcnow()
            if existing is None: db.add(entry)
            affected.add(flock.id)
        if errors:
            db.rollback()
            result["errors"] = errors
            return result
        db.flush()
        for flock_id in affected:
            flock = next(f for f in flock_rows if f.id == flock_id)
            _recalculate_sequence(db, module, flock, current_user.full_name)
        db.commit()
        result["committed"] = True
        return result
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Daily import failed and was rolled back: {exc}")
