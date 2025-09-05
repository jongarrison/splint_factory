-- Seed data migration: Admin user and Named Geometry templates

-- 1. Create Default Organization (if it doesn't exist)
INSERT OR IGNORE INTO "Organization" (id, name, description, isActive, createdAt, updatedAt)
VALUES (
  'org_default_12345678',
  'Default Organization',
  'Default organization for users without specific organization assignment',
  1,
  datetime('now'),
  datetime('now')
);

-- 2. Create admin user (jongarrison@gmail.com)
INSERT OR IGNORE INTO "User" (id, name, email, password, organizationId, role, createdAt, updatedAt)
VALUES (
  'user_admin_12345678',
  'Jon Garrison (Admin)',
  'jongarrison@gmail.com',
  '$2b$10$H2Om5PQQUUdhqTdIfnpztOPY.xGdElKofKQ8OelQ0CZAz2k/YTP9.',
  'org_default_12345678',
  'SYSTEM_ADMIN',
  datetime('now'),
  datetime('now')
);

-- 3. Named Geometry seed data (specific Infinity Splint design)

-- Infinity Splint 250904 (exact specification from requirements)
INSERT OR IGNORE INTO "NamedGeometry" (id, "GeometryName", "GeometryAlgorithmName", "GeometryInputParameterSchema", "CreatorID", "CreationTime")
VALUES (
  'geom_infinity_splint_250904',
  'Infinity Splint 250904',
  'infinity_splint_generator_250904',
  '[
    {
      "InputName": "inter-phalange-distance-mm",
      "InputDescription": "Inter-Phalange Distance (mm) - Measure from midpoint to midpoint of the phalange''s to be spanned by the splint",
      "InputType": "Float",
      "NumberMin": 25.0,
      "NumberMax": 60.0
    },
    {
      "InputName": "root-circumference-mm",
      "InputDescription": "Circumference (mm) at the midpoint of the splinted phalange closest to the metacarpus",
      "InputType": "Float",
      "NumberMin": 25.0,
      "NumberMax": 100.0
    },
    {
      "InputName": "mid-circumference-mm",
      "InputDescription": "Circumference (mm) at the joint to be surrounded by the splint",
      "InputType": "Float",
      "NumberMin": 25.0,
      "NumberMax": 100.0
    },
    {
      "InputName": "tip-circumference-mm",
      "InputDescription": "Circumference (mm) at the midpoint of the splinted phalange closest to the finger tip",
      "InputType": "Float",
      "NumberMin": 25.0,
      "NumberMax": 100.0
    },
    {
      "InputName": "flexion-degrees",
      "InputDescription": "Angle (degrees) of the desired bend in the splinted joint",
      "InputType": "Float",
      "NumberMin": 0.0,
      "NumberMax": 45.0
    }
  ]',
  'user_admin_12345678',
  datetime('now')
);