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
```

## Step 3: Define labels, descriptions, types, and ranges

| InputName | Label | Description | InputType | Min | Max |
|-----------|-------|-------------|-----------|-----|-----|
| c_left_mm | Left Finger Circumference (mm) | | Float | ? | ? |
| c_right_mm | Right Finger Circumference (mm) | | Float | ? | ? |
| full_perimeter_mm | Circumference of both fingers (mm) | Fingers should be in natural alignment | Float | ? | ? |
| right_forward_offset_mm | Forward Offset Of Right Finger (mm) | How far advanced should right ring be? Negative is ok | Float | ? | ? |

## Step 4: Decisions needed before creating definition.json

- [ ] **Number ranges** for each parameter (reasonable min/max values)
  - `c_left_mm` / `c_right_mm`: finger circumference, maybe ~30-120mm?
  - `full_perimeter_mm`: both fingers together, maybe ~70-250mm?
  - `right_forward_offset_mm`: offset, maybe -20 to 20mm?
- [ ] **InputType**: Float or Integer? (mm measurements are typically Float)
- [ ] **Short description** for the design card (e.g., "Buddy ring duo splint for two adjacent fingers")
- [ ] **Active from the start?** Or mark inactive until validated?
- [ ] **Preview and measurement images** ready, or placeholders for now?

## Step 5: Create the files

Once decisions above are made:

1. Generate a cuid for the design ID
2. Create `src/designs/buddy-rings-duo/definition.json` (with `$schema` ref)
3. Add preview.png / measurement.png to `public/designs/buddy-rings-duo/` (or placeholders)
4. Add import + entry in `src/designs/registry.ts`
5. Run seed sync to upsert the DB row: `cd splint_factory && npx tsx prisma/seed.ts`
6. Add OrganizationDesign visibility rows for orgs that should see it