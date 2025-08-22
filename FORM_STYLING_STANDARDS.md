# Form Input Styling Standards

## Consistent Form Input Classes

All form inputs throughout the application should use the following consistent styling pattern:

### Standard Input/Select/Textarea Classes:
```tsx
className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
```

### Small/Inline Input Classes:
```tsx
className="text-sm border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
```

### Key Components:
- **Text Color**: `text-gray-900` - Dark gray for good readability
- **Background**: `bg-white` - White background for contrast
- **Border**: `border-gray-300` - Light gray border
- **Focus States**: `focus:outline-none focus:ring-2 focus:ring-blue-500` - Blue ring on focus
- **Border Radius**: `rounded-md` for standard forms, `rounded` for inline forms

### Examples:

#### Standard Form Input:
```tsx
<input
  type="text"
  className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
  placeholder="Enter value"
/>
```

#### Select Dropdown:
```tsx
<select className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
  <option value="">Select option</option>
</select>
```

#### Readonly Input (for display):
```tsx
<input
  type="text"
  readOnly
  className="flex-1 p-2 text-sm bg-gray-50 border border-gray-300 rounded font-mono text-gray-900"
/>
```

## Files Updated with New Standards:
- `/src/app/admin/invitations/page.tsx` - All form inputs and selects
- `/src/app/admin/users/page.tsx` - Filter selects and inline table selects
- `/src/app/admin/page.tsx` - Organization creation form
- `/src/app/profile/page.tsx` - Profile and password change forms

## Files Already Compliant:
- `/src/app/login/page.tsx` - Login form (already has text-gray-900)
- `/src/app/register/page.tsx` - Registration form (already has text-gray-900)

## Future Development:
When creating new forms, always use the standard classes above to maintain consistency across the application. The dark text ensures good readability and user experience.
