# Adding a New Design Definition: BuddyRingsDuo

This document walks through integrating a new design into splint_factory's
Design-as-Code system. Use it as a template for future designs.

## Step 1: Gather algorithm info

- **Algorithm name**: BuddyRingsDuo
- **Grasshopper file**: `splint_geo_processor/generators/BuddyRingsDuo.gh`

## Step 2: Document input parameters from the .gh file

In rhino3d/grasshopper the data is loaded with these key names:

```python
c_left_mm = job_data["c_left_mm"]
c_right_mm = job_data["c_right_mm"]
full_perimeter_mm = job_data["full_perimeter_mm"]
right_forward_offset_mm = job_data["right_forward_offset_mm"]
b_left_slit = job_data["b_left_slit"]
b_right_slit = job_data["b_right_slit"]
```

## Step 3: Define labels, descriptions, types, and ranges

| InputName | Label | Description | InputType | Min | Max |
|-----------|-------|-------------|-----------|-----|-----|
| c_left_mm | Left Finger Circumference (mm) | | Float | 30 | 120 |
| c_right_mm | Right Finger Circumference (mm) | | Float | 30 | 120 |
| full_perimeter_mm | Circumference of both fingers (mm) | Fingers should be in natural alignment | Float | 70 | 250 |
| right_forward_offset_mm | Forward Offset Of Right Finger (mm) | How far advanced should right ring be? Negative is ok | Float | -20 | 20 |
| b_left_slit | Left Ring Sizing Slit? | | Boolean | | |
| b_right_slit | Right Ring Sizing Slit? | | Boolean | | |



## Step 4: Decisions needed before creating definition.json

- [x] **Number ranges** for each parameter (reasonable min/max values)
  - `c_left_mm` / `c_right_mm`: 30-120mm
  - `full_perimeter_mm`: 70-250mm
  - `right_forward_offset_mm`: -20 to 20mm
- [x] **InputType**: Float for measurements, Boolean for slit options
- [x] **Short description**: "Buddy ring duo splint for two adjacent fingers"
- [x] **Active from the start?** Yes, isActive: true
- [ ] **Preview and measurement images** ready, or placeholders for now?

## Step 5: Create the files

1. ~~Generate a cuid for the design ID~~ Done: `dgdc5pnf5eizil6lxm419jil`
2. ~~Create `src/designs/buddy-rings-duo/definition.json`~~ Done
3. Add preview.png / measurement.png to `public/designs/buddy-rings-duo/` (or placeholders)
4. ~~Add import + entry in `src/designs/registry.ts`~~ Done
5. Run seed sync to upsert the DB row: `cd splint_factory && npx tsx prisma/seed.ts`
6. Add OrganizationDesign visibility rows for orgs that should see it

## Notes

- Boolean InputType was added to the design-as-code system as part of this design.
  Convention: prefix boolean parameter names with `b_`. Defaults to `false`.
  Renders as a checkbox in the job creation form.
  Arrives in `splintcommon.load_job_data` as Python native `True`/`False`.