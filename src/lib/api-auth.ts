import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export interface ApiAuthResult {
  success: boolean;
  error?: string;
  apiKey?: {
    id: string;
    name: string;
    permissions: string[];
    organizationId: string | null;
  };
}

export async function validateApiKey(request: NextRequest): Promise<ApiAuthResult> {
  try {
    const authorization = request.headers.get('authorization');
    
    if (!authorization) {
      return { success: false, error: 'Authorization header missing' };
    }

    if (!authorization.startsWith('Bearer ')) {
      return { success: false, error: 'Invalid authorization format. Use Bearer <api-key>' };
    }

    const apiKeyValue = authorization.slice(7); // Remove 'Bearer ' prefix
    
    if (!apiKeyValue) {
      return { success: false, error: 'API key missing' };
    }

    // Find all active API keys and check against the provided key
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        name: true,
        keyHash: true,
        permissions: true,
        organizationId: true,
        lastUsedAt: true
      }
    });

    // Check each API key hash
    for (const apiKey of apiKeys) {
      const isValid = await bcrypt.compare(apiKeyValue, apiKey.keyHash);
      
      if (isValid) {
        // Update last used timestamp
        await prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() }
        });

        console.log(`API key authenticated: ${apiKey.name} (${apiKey.id})`);

        return {
          success: true,
          apiKey: {
            id: apiKey.id,
            name: apiKey.name,
            permissions: JSON.parse(apiKey.permissions),
            organizationId: apiKey.organizationId
          }
        };
      }
    }

    console.warn('Invalid API key attempted');
    return { success: false, error: 'Invalid API key' };

  } catch (error) {
    console.error('Error validating API key:', error);
    return { success: false, error: 'Internal server error' };
  }
}

export function hasPermission(permissions: string[], requiredPermission: string): boolean {
  return permissions.includes(requiredPermission) || permissions.includes('*');
}

export function checkApiPermission(apiKey: any, requiredPermission: string): boolean {
  if (!apiKey || !apiKey.permissions) {
    return false;
  }
  
  return hasPermission(apiKey.permissions, requiredPermission);
}