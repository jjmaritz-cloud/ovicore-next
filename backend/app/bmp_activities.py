"""Generate operational records from immutable flock BMP snapshots.
Dates are biological age from hatch; range tasks are one completion window.
"""
from collections import Counter
from datetime import date, timedelta
from uuid import uuid4

MAX_ACTIVITIES = 5000


def activate(snapshot, hatch, today, previous, actor, timestamp):
    if not snapshot or not hatch or hatch > today:
        raise ValueError('An assigned BMP and a valid hatch date are required')
    state = previous or {}
    if state.get('version_id') == snapshot['id']:
        return state
    records = [dict(r) for r in state.get('records', [])]
    for r in records:
        # Retain completed and already due activities; replace future activities only.
        if r['status'] == 'pending' and r['start_date'] > today.isoformat():
            r.update(status='superseded', superseded_at=timestamp, superseded_by=actor)
    retained = [r for r in records if r['status'] != 'superseded']
    keys = {(r['category'], r['title'].strip().casefold(), r['start_date']) for r in retained}
    # A moved one-off can be matched only when its title/category is unique in
    # both the retained records and new programme. Exact date keys cover repeats.
    old_counts = Counter((r['category'], r['title'].strip().casefold()) for r in retained if r['schedule_type'] != 'recurring')
    new_counts = Counter((t['category'], t['title'].strip().casefold()) for t in snapshot['tasks'] if t.get('schedule_type', 'once') != 'recurring' and t.get('requires_signoff', True))
    single_keys = {k for k, n in old_counts.items() if n == 1 and new_counts[k] == 1}
    for task in snapshot['tasks']:
        if not task.get('requires_signoff', True):
            continue
        mode = task.get('schedule_type', 'once')
        start = int(task['age_day'])
        end = int(task.get('end_age_day') if task.get('end_age_day') is not None else start)
        if not 0 <= start <= end <= 1500 or mode not in ('once','range','recurring'):
            raise ValueError('Invalid activity schedule')
        interval = int(task.get('interval_days') or 0) if mode == 'recurring' else 1
        if interval < 1:
            raise ValueError('Invalid activity interval')
        ages = range(start, end + 1, interval) if mode == 'recurring' else [start]
        title, category = task['title'], task['category']
        for age in ages:
            first = hatch + timedelta(days=age)
            due = hatch + timedelta(days=end if mode == 'range' else age)
            if due < today:
                continue
            key = (category, title.strip().casefold(), first.isoformat())
            if key in keys or (mode != 'recurring' and key[:2] in single_keys):
                continue
            if len(records) >= MAX_ACTIVITIES:
                raise ValueError('Activity history limit exceeded; review the programme schedule')
            records.append(dict(id=str(uuid4()), version_id=snapshot['id'], version=snapshot['version'],
                title=title, category=category, instructions=task.get('instructions',''),
                responsible=task.get('responsible','Farm Manager'), schedule_type=mode,
                start_date=first.isoformat(), due_date=due.isoformat(), status='pending',
                generated_at=timestamp, generated_by=actor))
            keys.add(key)
    return dict(version_id=snapshot['id'], activated_on=today.isoformat(), activated_at=timestamp,
                activated_by=actor, records=records)


def complete(state, activity_id, actual, today, actor, timestamp, comments):
    if not state or actual > today:
        raise ValueError('A valid actual completion date is required')
    records = [dict(r) for r in state['records']]
    record = next((r for r in records if r['id'] == activity_id), None)
    if record is None or record['status'] != 'pending':
        raise ValueError('Activity is not pending; reload the register')
    if actual < date.fromisoformat(record['start_date']):
        raise ValueError('Completion date cannot precede the scheduled activity start')
    record.update(status='completed', actual_date=actual.isoformat(), signed_at=timestamp,
                  signed_by=actor, comments=comments)
    return {**state, 'records': records}
