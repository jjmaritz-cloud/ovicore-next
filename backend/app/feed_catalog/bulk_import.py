"""Company-scoped, preview-first XLSX formula import (all-or-nothing, draft only)."""
from io import BytesIO
from uuid import uuid4
from decimal import Decimal
from fastapi import Depends, File, Form, HTTPException, UploadFile, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from openpyxl import load_workbook

MAX_FILE_BYTES = 2_000_000
REQUIRED_SHEETS = ('Rations', 'Ingredients AMEn', 'Formula Lines')


def read_workbook(raw):
    if not raw or len(raw) > MAX_FILE_BYTES:
        raise ValueError('Workbook must be XLSX and smaller than 2 MB')
    try:
        wb = load_workbook(BytesIO(raw), read_only=True, data_only=True)
    except Exception as exc:
        raise ValueError('Cannot read XLSX workbook') from exc
    try:
        missing = set(REQUIRED_SHEETS) - set(wb.sheetnames)
        if missing: raise ValueError('Missing sheets: ' + ', '.join(sorted(missing)))
        def rows(sheet):
            values = wb[sheet].values
            headers = [str(c).strip() if c is not None else '' for c in next(values)]
            return [dict(zip(headers, row)) for row in values if row[0] is not None and str(row[0]).strip()]
        rations, ingredients, lines = (rows(s) for s in REQUIRED_SHEETS)
    finally:
        wb.close()
    if len(rations) == 0 or len(rations) > 150 or len(ingredients)>1000 or len(lines)>20000:
        raise ValueError('Invalid number of ration, ingredient or formula records')
    ingredient_by_code = {}
    for item in ingredients:
        code = str(item.get('Mill Ingredient Code') or '').strip()
        if not code or code in ingredient_by_code: raise ValueError('Duplicate or empty ingredient code: ' + code)
        ingredient_by_code[code] = item
    ration_by_code = {}
    for item in rations:
        code = str(item.get('Ration Code') or '').strip().upper()
        if not code or code in ration_by_code: raise ValueError('Duplicate or empty ration code: ' + code)
        ration_by_code[code] = item
    grouped = {code: [] for code in ration_by_code}
    for item in lines:
        code = str(item.get('Ration Code') or '').strip().upper()
        ingredient_code = str(item.get('Mill Ingredient Code') or '').strip()
        if code not in grouped or ingredient_code not in ingredient_by_code:
            raise ValueError('Unknown ration or ingredient in formula lines: '+ code + '/' + ingredient_code)
        try: percent = Decimal(str(item['Inclusion %']))
        except Exception as exc: raise ValueError('Non-numeric inclusion percentage') from exc
        if not percent.is_finite() or percent <= 0 or percent > 100: raise ValueError('Invalid inclusion percentage')
        if any(x[0] == ingredient_code for x in grouped[code]): raise ValueError('Duplicate formula ingredient '+code+'/'+ingredient_code)
        version = str(item.get('Formula Version') or '').strip()
        if version != str(ration_by_code[code].get('Formula Version') or '').strip():
            raise ValueError('Formula version mismatch for '+code)
        grouped[code].append((ingredient_code, percent))
    for code, items in grouped.items():
        if abs(sum((pct for _,pct in items), Decimal(0))-100) > Decimal('0.001'):
            raise ValueError(f'Inclusions for {code} must total 100%, not {sum(p for _,p in items)}%')
    return rations, ingredients, grouped


def attach_bulk_import(router, get_db, get_current_user, require_feed_editor, company, models):
    Mill, Ingredient, Ration = models
    async def prepare(file, mill_id, company_id, db, principal):
        cid = company(db, principal, company_id)
        mill = db.execute(select(Mill).where(Mill.company_id==cid, Mill.id==mill_id)).scalar_one_or_none()
        if not mill or mill.status != 'Active': raise HTTPException(422, 'Choose an active supplying mill')
        raw = await file.read(MAX_FILE_BYTES + 1)
        try: rations, ingredients, grouped = read_workbook(raw)
        except ValueError as exc: raise HTTPException(422, str(exc)) from exc
        old_ingredients = {i.code.upper():i for i in db.execute(select(Ingredient).where(Ingredient.company_id==cid)).scalars()}
        old_rations = {r.code.upper():r for r in db.execute(select(Ration).where(Ration.company_id==cid, Ration.mill_id==mill_id)).scalars()}
        collisions=[]
        for item in rations:
            code = str(item['Ration Code']).strip().upper()
            if code in old_rations: collisions.append('Existing ration code: '+code)
        for item in ingredients:
            code = str(item['Mill Ingredient Code']).strip().upper()
            old = old_ingredients.get(code)
            if old and old.name.strip().casefold()!=str(item['Ingredient Name']).strip().casefold():
                collisions.append(f'Ingredient {code} name differs from existing: {old.name}')
        sku_set={r.supplier_code.upper() for r in old_rations.values()}
        for r in rations:
            code=str(r['Ration Code']).strip().upper()
            if code in sku_set: collisions.append('Supplier SKU already exists: '+code)
        for i in ingredients:
            energy=i.get('Poultry AMEn MJ/kg as-fed (ENTER)')
            if energy not in (None,''):
                try:
                    value=Decimal(str(energy))
                    if not value.is_finite() or value<0 or value>50: raise ValueError()
                except Exception: collisions.append('Invalid AMEn for ingredient '+str(i.get('Mill Ingredient Code')))
        source_mills=sorted({str(r.get('Mill') or '') for r in rations})
        summary={'rations':len(rations),'ingredients':len(ingredients),'inclusion_lines':sum(map(len,grouped.values())),
                 'new_ingredients':sum(str(i['Mill Ingredient Code']).strip().upper() not in old_ingredients for i in ingredients),
                 'existing_ingredients':sum(str(i['Mill Ingredient Code']).strip().upper() in old_ingredients for i in ingredients),
                 'target_mill':mill.name,'source_mills':source_mills,
                 'warnings':['All rations are imported as Draft; approved status and dated formulation versions require separate approval.',
                             'Missing ingredient AMEn remains blank; no energy estimate is invented.',
                             'Source report date does not establish formulation effective date.'] +
                             ([f'Source mill ({", ".join(source_mills)}) differs from target ({mill.name}); sandbox mapping only.'] if source_mills!=[mill.name] else []),
                 'errors':collisions,
                 'ration_codes':[str(r['Ration Code']) for r in rations]}
        return cid, mill, rations, ingredients, grouped, old_ingredients, summary

    @router.post('/import-preview')
    async def preview(file:UploadFile=File(...),mill_id:str=Form(...),company_id:int|None=Query(default=None,ge=1),
                      db=Depends(get_db),principal=Depends(get_current_user),_editor=Depends(require_feed_editor)):
        _,_,_,_,_,_,summary=await prepare(file,mill_id,company_id,db,principal)
        return summary

    @router.post('/import-apply')
    async def apply(file:UploadFile=File(...),mill_id:str=Form(...),confirm:bool=Form(False),
                    company_id:int|None=Query(default=None,ge=1),db=Depends(get_db),
                    principal=Depends(get_current_user),_editor=Depends(require_feed_editor)):
        if not confirm: raise HTTPException(400,'Explicit confirmation required')
        cid,mill,rations,ingredients,grouped,old_ingredients,summary=await prepare(file,mill_id,company_id,db,principal)
        if summary['errors']: raise HTTPException(409,{'errors':summary['errors']})
        refs={}
        try:
            for i in ingredients:
                code=str(i['Mill Ingredient Code']).strip().upper()
                existing=old_ingredients.get(code)
                if existing:
                    refs[code]=existing.id
                    continue # Never overwrite existing specifications / prices / energy
                energy=i.get('Poultry AMEn MJ/kg as-fed (ENTER)')
                price=Decimal(str(i.get('Reported Owning AUD/t') or 0))
                if not price.is_finite() or price<0: raise ValueError(f'Invalid price for ingredient {code}')
                if energy not in (None,''): energy = str(Decimal(str(energy)))
                else: energy=''
                item=Ingredient(id=str(uuid4()),company_id=cid,code=code,name=str(i['Ingredient Name']).strip(),
                                category='Imported - review',price=price,protein='',energy=energy,status='Active',
                                notes=f'Imported from {i.get("Mill") or "source workbook"}; verify cost, AMEn and category before approval.')
                db.add(item);refs[code]=item.id
            for r in rations:
                code=str(r['Ration Code']).strip().upper()
                name=str(r['Ration Description']).strip()
                phase=('Starter' if code=='PBCS' else 'Grower' if code=='PBPG' else 'Developer' if code=='PBPD'
                       else 'Pre-peaking' if code in ('PBAS','PBCC') else 'Layer '+code[-1])
                is_medicated=code in ('PBCS','PBPG')
                attributes=[('Source mill',r.get('Mill')),('Plant',r.get('Plant')),('Formula version',r.get('Formula Version')),
                            ('Report date',r.get('Source Report Date')),('Effective date',r.get('Formulation Effective From (CONFIRM)')),
                            ('Reported formula cost AUD/t',r.get('Formula Cost AUD/t (reported)'))]
                for label,col in [('Crude Protein %','Crude Protein %'),('Crude Fat %','Crude Fat %'),('Ash %','Ash %'),('Calcium %','Calcium %'),('Total Phos %','Total Phos %'),('Sodium %','Sodium %'),('Chloride %','Chloride %'),('Potassium %','Potassium %')]:
                    attributes.append((label,r.get(col)))
                notes='Imported draft from CFC formulation report. Review/approval required.\n'+'\n'.join(f'{k}: {v}' for k,v in attributes if v not in ('',None))
                db.add(Ration(id=str(uuid4()),company_id=cid,mill_id=mill.id,code=code,name=name,
                              supplier_code=code,supplier_name=name,phase=phase,
                              type='Medicated' if is_medicated else 'Base',base_id=None,status='Draft',notes=notes,
                              lines=[{'ingredientId':refs[ic],'percent':float(percent)} for ic,percent in grouped[code]]))
            db.commit()
        except IntegrityError as exc:
            db.rollback();raise HTTPException(409,'Import conflict: database record already exists') from exc
        except (ValueError,TypeError) as exc:
            db.rollback();raise HTTPException(422,str(exc)) from exc
        return {'imported_rations':len(rations),'imported_ingredients':summary['new_ingredients'],
                'reused_ingredients':summary['existing_ingredients'],'target_mill':mill.name,'status':'Draft'}


    # Distinct from formula import: update ONLY the existing ingredient.energy field.
    # No ration, price, status, formulation or historical assignment is changed.
    async def prepare_amen_update(file, mill_id, company_id, db, principal):
        cid = company(db, principal, company_id)
        mill = db.execute(select(Mill).where(Mill.company_id == cid, Mill.id == mill_id)).scalar_one_or_none()
        if mill is None or mill.status != 'Active':
            raise HTTPException(422, 'Select an active destination mill')
        raw = await file.read(MAX_FILE_BYTES + 1)
        try:
            rations, ingredients, grouped = read_workbook(raw)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        saved_rations = {r.code.upper(): r for r in db.execute(select(Ration).where(
            Ration.company_id == cid, Ration.mill_id == mill_id)).scalars().all()}
        errors = []
        for source in rations:
            code = str(source['Ration Code']).strip().upper()
            saved = saved_rations.get(code)
            if saved is None:
                errors.append(f'Ration {code} is not present in the selected destination mill')
            elif saved.status != 'Draft':
                errors.append(f'Ration {code} is {saved.status}; this sandbox update requires all imported rations to remain Draft')
            else:
                by_ingredient = {entry['ingredientId']: Decimal(str(entry['percent'])) for entry in (saved.lines or [])}
                if len(by_ingredient) != len(grouped[code]):
                    errors.append(f'Ration {code} has a different number of formulation lines')
        saved_ingredients = {i.code.strip().upper(): i for i in db.execute(select(Ingredient).where(
            Ingredient.company_id == cid)).scalars().all()}
        # Ensure this workbook is for the exact existing formulations, not only matching ration codes.
        for source in rations:
            code = str(source['Ration Code']).strip().upper()
            saved = saved_rations.get(code)
            if saved is None:
                continue
            expected = {saved_ingredients[ingredient_code.upper()].id: percentage for ingredient_code, percentage in grouped[code]
                        if ingredient_code.upper() in saved_ingredients}
            actual = {line['ingredientId']: Decimal(str(line['percent'])) for line in (saved.lines or [])}
            if set(expected) != set(actual) or any(abs(expected[k] - actual[k]) > Decimal('0.001') for k in expected if k in actual):
                errors.append(f'Ration {code} formulation differs from workbook; refusing update')
        updates = []
        zero_assumptions = []
        seen = set()
        for source in ingredients:
            code = str(source.get('Mill Ingredient Code') or '').strip().upper()
            if code in seen:
                errors.append(f'Duplicate ingredient code {code}')
                continue
            seen.add(code)
            ingredient = saved_ingredients.get(code)
            if ingredient is None:
                errors.append(f'Ingredient {code} is not present in this company; this action never creates records')
                continue
            if ingredient.name.strip().casefold() != str(source.get('Ingredient Name') or '').strip().casefold():
                errors.append(f'Ingredient code {code} name mismatch: {ingredient.name}')
                continue
            cell = source.get('Poultry AMEn MJ/kg as-fed (PROVISIONAL)')
            if cell in (None, ''):
                errors.append(f'Missing provisional AMEn for {code}')
                continue
            try:
                value = Decimal(str(cell))
                if not value.is_finite() or value < 0 or value > 50:
                    raise ValueError()
            except (TypeError, ValueError, ArithmeticError):
                errors.append(f'Invalid AMEn for ingredient {code}')
                continue
            caution = str(source.get('Validation / caution') or '')
            reference = str(source.get('Reference URL / assumption') or '')
            if value == 0 and ('unverified' in caution.casefold() or 'assumption' in reference.casefold()):
                zero_assumptions.append(code)
            previous = str(ingredient.energy or '').strip()
            if previous:
                try:
                    previous_number = Decimal(previous)
                except Exception:
                    errors.append(f'Existing AMEn for {code} is non-numeric; review manually')
                    continue
            else:
                previous_number = None
            if previous_number != value:
                updates.append({'code': code, 'name': ingredient.name, 'old': previous,
                                'new': str(value), 'reference': reference[:255], 'caution': caution[:450],
                                'ingredient': ingredient})
        # This import action may not change energy of an ingredient used by an Approved ration.
        # This prevents silently altering estimated nutrition for approved formulations.
        approved = db.execute(select(Ration).where(Ration.company_id == cid,
            Ration.status == 'Approved')).scalars().all()
        protected_ids = {line.get('ingredientId') for r in approved for line in (r.lines or [])}
        for update in updates:
            if update['ingredient'].id in protected_ids:
                errors.append(f'Ingredient {update["code"]} is used by an Approved ration; update blocked to protect existing estimates')
        source_mills = sorted({str(r.get('Mill') or '') for r in rations})
        preview = {'target_mill': mill.name, 'source_mills': source_mills,
                   'rations_checked': len(rations), 'ingredients_checked': len(ingredients),
                   'updates': [{key: u[key] for key in ('code','name','old','new','reference','caution')} for u in updates],
                   'unchanged': len(ingredients) - len(updates), 'zero_assumptions': zero_assumptions,
                   'warnings': [
                       'SANDBOX PROVISIONAL VALUES ONLY. Not formulated or lab-verified AMEn.',
                       'Some zero entries are unverified assumptions for amino acids and additives; they are not measured zeros.',
                       'Only ingredient energy (MJ/kg as-fed) changes. Ration formulation, price and status remain unchanged.',
                       'Existing historical energy assignment snapshots are not recalculated. Confirm actual ration changes separately.',
                   ], 'errors': errors}
        if source_mills != [mill.name]:
            preview['warnings'].append('Source mill differs from sandbox destination; confirm mapping before applying.')
        return db, preview, updates

    @router.post('/amen-update-preview')
    async def amen_update_preview(file: UploadFile = File(...), mill_id: str = Form(...),
                                  company_id: int | None = Query(default=None, ge=1),
                                  db = Depends(get_db), principal = Depends(get_current_user),
                                  _editor = Depends(require_feed_editor)):
        _, preview, _ = await prepare_amen_update(file, mill_id, company_id, db, principal)
        return preview

    @router.post('/amen-update-apply')
    async def amen_update_apply(file: UploadFile = File(...), mill_id: str = Form(...),
                                confirm: bool = Form(False),
                                company_id: int | None = Query(default=None, ge=1),
                                db = Depends(get_db), principal = Depends(get_current_user),
                                _editor = Depends(require_feed_editor)):
        if not confirm:
            raise HTTPException(400, 'Explicit confirmation required')
        _, preview, updates = await prepare_amen_update(file, mill_id, company_id, db, principal)
        if preview['errors']:
            raise HTTPException(409, {'errors': preview['errors']})
        try:
            for change in updates:
                item = change['ingredient']
                item.energy = change['new']
                provenance = ('SANDBOX AMEn reference/proxy, not verified; '
                              f'Source: {change["reference"]}; Caution: {change["caution"]}')
                if provenance not in (item.notes or ''):
                    item.notes = ((item.notes or '').rstrip() + '\n' + provenance).strip()[:4000]
            db.commit()
        except Exception:
            db.rollback()
            raise
        return {'updated_ingredients': len(updates), 'unchanged_ingredients': preview['unchanged'],
                'destination_mill': preview['target_mill'], 'status': 'Provisional AMEn reference values'}
