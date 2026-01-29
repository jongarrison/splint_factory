import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/maintenance-status - Public endpoint to check maintenance mode status
export async function GET() {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system_settings' },
      select: {
        maintenanceModeEnabled: true,
        maintenanceMessage: true
      }
    });

    return NextResponse.json({
      maintenanceModeEnabled: settings?.maintenanceModeEnabled || false,
      maintenanceMessage: settings?.maintenanceMessage || null
    });

  } catch (error) {
    console.error('Error getting maintenance status:', error);
    // Return disabled state on error to avoid blocking users
    return NextResponse.json({
      maintenanceModeEnabled: false,
      maintenanceMessage: null
    });
  }
}
